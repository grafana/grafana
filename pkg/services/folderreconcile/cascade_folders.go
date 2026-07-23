package folderreconcile

import (
	"context"
	"fmt"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/client-go/dynamic"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ProvideAsyncReconciler wires the async reconciler with the concrete folder client and content
// deleters, run in design order: library panels, then alert rules, then dashboards.
func ProvideAsyncReconciler(
	cfg *setting.Cfg,
	searcher resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
	orgs org.Service,
	alertRules *ngalert.AlertRuleFolderConsumer,
	libraryPanels *libraryelements.FolderConsumer,
	dashboards *dashboardservice.FolderConsumer,
) *AsyncReconciler {
	interval := cfg.SectionWithEnvOverrides("folder").Key("cascade_delete_reconcile_interval").MustDuration(time.Minute)
	folders := newCascadeFolders(cfg, searcher, configProvider)
	return newAsyncReconciler(folders, orgs, interval, libraryPanels, alertRules, dashboards)
}

const cascadePageSize int64 = 1000

// cascadeFolders implements CascadeFolders against the folder API server: the search index for
// enumeration and a lazily-built dynamic client for mutations.
type cascadeFolders struct {
	searcher       resourcepb.ResourceIndexClient
	namespacer     request.NamespaceMapper
	configProvider apiserver.RestConfigProvider

	mu     sync.Mutex
	client dynamic.NamespaceableResourceInterface
}

func newCascadeFolders(cfg *setting.Cfg, searcher resource.ResourceClient, configProvider apiserver.RestConfigProvider) *cascadeFolders {
	return &cascadeFolders{
		searcher:       searcher,
		namespacer:     request.GetNamespaceMapper(cfg),
		configProvider: configProvider,
	}
}

func (c *cascadeFolders) Terminating(ctx context.Context, orgID int64) ([]string, error) {
	return c.search(ctx, c.namespacer(orgID), nil, terminatingLabelReq())
}

func (c *cascadeFolders) Children(ctx context.Context, orgID int64, folderUID string) ([]ChildFolder, error) {
	ns := c.namespacer(orgID)
	parent := []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER, Operator: string(selection.Equals), Values: []string{folderUID}}}
	all, err := c.search(ctx, ns, parent, nil)
	if err != nil {
		return nil, err
	}
	// A child already carrying the terminating label has its own deletion underway.
	terminating, err := c.search(ctx, ns, parent, terminatingLabelReq())
	if err != nil {
		return nil, err
	}
	term := make(map[string]struct{}, len(terminating))
	for _, uid := range terminating {
		term[uid] = struct{}{}
	}
	children := make([]ChildFolder, 0, len(all))
	for _, uid := range all {
		_, t := term[uid]
		children = append(children, ChildFolder{UID: uid, Terminating: t})
	}
	return children, nil
}

func (c *cascadeFolders) Delete(ctx context.Context, orgID int64, folderUID string) error {
	client, err := c.folderClient(ctx)
	if err != nil {
		return err
	}
	// gracePeriodSeconds=0 selects the force path that starts async cascade delete on the folder.
	zero := int64(0)
	err = client.Namespace(c.namespacer(orgID)).Delete(ctx, folderUID, metav1.DeleteOptions{GracePeriodSeconds: &zero})
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

func (c *cascadeFolders) RemoveFinalizer(ctx context.Context, orgID int64, folderUID string) error {
	client, err := c.folderClient(ctx)
	if err != nil {
		return err
	}
	ns := client.Namespace(c.namespacer(orgID))
	obj, err := ns.Get(ctx, folderUID, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	kept := make([]string, 0, len(obj.GetFinalizers()))
	for _, f := range obj.GetFinalizers() {
		if f != foldersv1.FinalizerCascadeDelete {
			kept = append(kept, f)
		}
	}
	if len(kept) == len(obj.GetFinalizers()) {
		return nil
	}
	obj.SetFinalizers(kept)
	_, err = ns.Update(ctx, obj, metav1.UpdateOptions{})
	return err
}

func (c *cascadeFolders) MarkFailed(ctx context.Context, orgID int64, folderUID, reason string) error {
	client, err := c.folderClient(ctx)
	if err != nil {
		return err
	}
	ns := client.Namespace(c.namespacer(orgID))
	obj, err := ns.Get(ctx, folderUID, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	labels := obj.GetLabels()
	if labels == nil {
		labels = map[string]string{}
	}
	labels[foldersv1.LabelTerminatingStatus] = foldersv1.LabelValueFailed
	obj.SetLabels(labels)
	anns := obj.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	anns[foldersv1.AnnotationTerminatingError] = reason
	obj.SetAnnotations(anns)
	_, err = ns.Update(ctx, obj, metav1.UpdateOptions{})
	return err
}

// folderClient builds the folder dynamic client lazily from the rest config.
func (c *cascadeFolders) folderClient(ctx context.Context) (dynamic.NamespaceableResourceInterface, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.client != nil {
		return c.client, nil
	}
	cfg, err := c.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rest config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}
	c.client = dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource())
	return c.client, nil
}

// search returns the folder names matching the given field/label requirements, paging through results.
func (c *cascadeFolders) search(ctx context.Context, namespace string, fields, labels []*resourcepb.Requirement) ([]string, error) {
	gvr := foldersv1.FolderResourceInfo.GroupVersionResource()
	var (
		names  []string
		offset int64
	)
	for {
		resp, err := c.searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: namespace, Group: gvr.Group, Resource: gvr.Resource},
				Fields: fields,
				Labels: labels,
			},
			Limit:  cascadePageSize,
			Offset: offset,
		})
		if err != nil {
			return nil, fmt.Errorf("search folders: %w", err)
		}
		if resp.Error != nil {
			return nil, fmt.Errorf("search folders: %s", resp.Error.Message)
		}
		if resp.Results == nil || len(resp.Results.Rows) == 0 {
			return names, nil
		}
		for _, row := range resp.Results.Rows {
			if row.Key != nil {
				names = append(names, row.Key.Name)
			}
		}
		// The bleve Search path drives pagination off TotalHits + offset rather than a page token.
		offset += int64(len(resp.Results.Rows))
		if offset >= resp.TotalHits {
			return names, nil
		}
	}
}

func terminatingLabelReq() []*resourcepb.Requirement {
	return []*resourcepb.Requirement{{
		Key:      foldersv1.LabelTerminating,
		Operator: string(selection.Equals),
		Values:   []string{foldersv1.LabelValueTrue},
	}}
}

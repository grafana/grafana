package prometheusrule

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var _ grafanarest.Storage = (*legacyStorage)(nil)

// defaultFolderTitle is the title used when auto-creating a folder for resources
// posted without an explicit folder annotation.
const defaultFolderTitle = "PrometheusRules"

type legacyStorage struct {
	service         provisioning.AlertRuleService
	resolver        NamespaceResolver
	namespacer      request.NamespaceMapper
	defaultInterval time.Duration
	tableConverter  rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object     { return ResourceInfo.NewFunc() }
func (s *legacyStorage) Destroy()                {}
func (s *legacyStorage) NamespaceScoped() bool   { return true }
func (s *legacyStorage) GetSingularName() string { return ResourceInfo.GetSingularName() }
func (s *legacyStorage) NewList() runtime.Object { return ResourceInfo.NewListFunc() }

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	hasProm := true
	allGroups, err := s.service.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: &hasProm,
	})
	if err != nil {
		return nil, err
	}

	// Partition by the source label, preserving group order within each partition.
	bySource := map[string][]*ngmodels.AlertRuleGroup{}
	provBySource := map[string]ngmodels.Provenance{}
	for i := range allGroups {
		group := allGroups[i].AlertRuleGroup
		if group == nil || len(group.Rules) == 0 {
			continue
		}
		source := group.Rules[0].Labels[SourceLabelKey]
		if source == "" {
			// Group's rules don't carry our source label; not produced by this kind.
			continue
		}
		bySource[source] = append(bySource[source], group)
		if _, ok := provBySource[source]; !ok {
			provBySource[source] = group.Provenance
		}
	}

	list := &model.PrometheusRuleList{Items: make([]model.PrometheusRule, 0, len(bySource))}
	// Stable iteration order so List output doesn't churn.
	sources := make([]string, 0, len(bySource))
	for s := range bySource {
		sources = append(sources, s)
	}
	sort.Strings(sources)
	for _, src := range sources {
		groups := bySource[src]
		sort.SliceStable(groups, func(i, j int) bool { return groups[i].Title < groups[j].Title })
		k8s, err := reassembleResource(info.OrgID, src, groups, provBySource[src], s.namespacer)
		if err != nil {
			if errors.Is(err, errMissingOriginalRule) {
				// Skip resources whose rules predate KeepOriginalRuleDefinition; we
				// can't reconstruct the source spec without it.
				continue
			}
			return nil, err
		}
		list.Items = append(list.Items, *k8s)
	}
	return list, nil
}

func (s *legacyStorage) findGroupsForSource(ctx context.Context, user identity.Requester, source string) ([]*ngmodels.AlertRuleGroup, ngmodels.Provenance, error) {
	hasProm := true
	allGroups, err := s.service.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: &hasProm,
	})
	if err != nil {
		return nil, "", err
	}

	matched := make([]*ngmodels.AlertRuleGroup, 0)
	var provenance ngmodels.Provenance
	for i := range allGroups {
		group := allGroups[i].AlertRuleGroup
		if group == nil || len(group.Rules) == 0 {
			continue
		}
		if group.Rules[0].Labels[SourceLabelKey] != source {
			continue
		}
		matched = append(matched, group)
		if provenance == "" {
			provenance = group.Provenance
		}
	}
	sort.SliceStable(matched, func(i, j int) bool { return matched[i].Title < matched[j].Title })
	if len(matched) == 0 {
		return nil, "", k8serrors.NewNotFound(ResourceInfo.GroupResource(), source)
	}
	return matched, provenance, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	groups, provenance, err := s.findGroupsForSource(ctx, user, name)
	if err != nil {
		return nil, err
	}
	return reassembleResource(info.OrgID, name, groups, provenance, s.namespacer)
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	pr, ok := obj.(*model.PrometheusRule)
	if !ok {
		return nil, k8serrors.NewBadRequest("expected a PrometheusRule object")
	}
	if pr.GenerateName != "" {
		return nil, fmt.Errorf("generate-name is not supported in legacy storage mode")
	}
	if pr.Name == "" {
		return nil, k8serrors.NewBadRequest("metadata.name is required")
	}

	folderRef, err := readFolderUID(pr)
	if err != nil {
		return nil, err
	}
	folderUID, err := s.resolveFolder(ctx, user, folderRef)
	if err != nil {
		return nil, err
	}
	datasourceUID := annotationValue(pr.Annotations, DatasourceUIDAnnotationKey)

	domainGroups, provenance, err := convertToDomainGroups(info.OrgID, folderUID, datasourceUID, s.defaultInterval, pr.Name, pr)
	if err != nil {
		return nil, err
	}
	if err := s.service.ReplaceRuleGroups(ctx, user, domainGroups, provenance, "Created via PrometheusRule"); err != nil {
		return nil, err
	}

	stored, _, err := s.findGroupsForSource(ctx, user, pr.Name)
	if err != nil {
		return nil, err
	}
	return reassembleResource(info.OrgID, pr.Name, stored, provenance, s.namespacer)
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}

	pr, ok := obj.(*model.PrometheusRule)
	if !ok {
		return nil, false, k8serrors.NewBadRequest("expected a PrometheusRule object")
	}

	folderRef, err := readFolderUID(pr)
	if err != nil {
		return nil, false, err
	}
	folderUID, err := s.resolveFolder(ctx, user, folderRef)
	if err != nil {
		return nil, false, err
	}
	datasourceUID := annotationValue(pr.Annotations, DatasourceUIDAnnotationKey)

	// Delete any groups removed in this update; the update path otherwise
	// silently leaves stale Grafana groups behind.
	if err := s.pruneRemovedGroups(ctx, user, name, pr); err != nil {
		return nil, false, err
	}

	domainGroups, provenance, err := convertToDomainGroups(info.OrgID, folderUID, datasourceUID, s.defaultInterval, name, pr)
	if err != nil {
		return nil, false, err
	}
	if err := s.service.ReplaceRuleGroups(ctx, user, domainGroups, provenance, "Updated via PrometheusRule"); err != nil {
		return nil, false, err
	}

	stored, _, err := s.findGroupsForSource(ctx, user, name)
	if err != nil {
		return nil, false, err
	}
	updated, err := reassembleResource(info.OrgID, name, stored, provenance, s.namespacer)
	if err != nil {
		return nil, false, err
	}
	return updated, false, nil
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}

	groups, provenance, err := s.findGroupsForSource(ctx, user, name)
	if err != nil {
		return nil, false, err
	}
	for _, g := range groups {
		if err := s.service.DeleteRuleGroup(ctx, user, g.FolderUID, g.Title, provenance); err != nil {
			return old, false, fmt.Errorf("deleting group %q: %w", g.Title, err)
		}
	}
	return old, false, nil
}

// pruneRemovedGroups deletes any group that was associated with the source
// resource but is no longer present in the incoming desired spec.
func (s *legacyStorage) pruneRemovedGroups(ctx context.Context, user identity.Requester, source string, desired *model.PrometheusRule) error {
	existing, provenance, err := s.findGroupsForSource(ctx, user, source)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return nil
		}
		return err
	}
	desiredNames := make(map[string]struct{}, len(desired.Spec.Groups))
	for _, g := range desired.Spec.Groups {
		desiredNames[g.Name] = struct{}{}
	}
	for _, g := range existing {
		if _, keep := desiredNames[g.Title]; keep {
			continue
		}
		if err := s.service.DeleteRuleGroup(ctx, user, g.FolderUID, g.Title, provenance); err != nil {
			return fmt.Errorf("pruning removed group %q: %w", g.Title, err)
		}
	}
	return nil
}

// readFolderUID returns the folder UID from the canonical grafana.app/folder
// annotation via the shared GrafanaMetaAccessor. Returns an empty string when
// the annotation is absent so the caller can decide whether to auto-create.
func readFolderUID(pr *model.PrometheusRule) (string, error) {
	accessor, err := utils.MetaAccessor(pr)
	if err != nil {
		return "", fmt.Errorf("reading object metadata: %w", err)
	}
	return accessor.GetFolder(), nil
}

// resolveFolder maps the grafana.app/folder annotation value to a real
// upstream folder UID. The hardcoded "PrometheusRules" parent is always
// ensured. When ref is empty the parent itself is used. When ref is an
// existing folder UID it is returned as-is (preserves Spec.FolderUID /
// FolderRef intent from the operator). Otherwise ref is treated as a folder
// title and find-or-created under the parent (the path that drop-in
// migrations from VMRule / prometheus-operator manifests hit by default).
// folder-create permission is enforced internally by the folder service
// during the Create calls below, matching what /api/convert/prometheus does.
func (s *legacyStorage) resolveFolder(ctx context.Context, user identity.Requester, ref string) (string, error) {
	if s.resolver == nil {
		return "", fmt.Errorf("no folder resolver configured")
	}

	parent, _, err := s.resolver.GetOrCreateNamespaceByTitle(ctx, defaultFolderTitle, user.GetOrgID(), user, folder.RootFolderUID)
	if err != nil {
		return "", fmt.Errorf("resolving %q parent folder: %w", defaultFolderTitle, err)
	}
	if ref == "" {
		return parent.UID, nil
	}

	if existing, err := s.resolver.GetNamespaceByUID(ctx, ref, user.GetOrgID(), user); err == nil && existing != nil {
		return existing.UID, nil
	}

	child, _, err := s.resolver.GetOrCreateNamespaceByTitle(ctx, ref, user.GetOrgID(), user, parent.UID)
	if err != nil {
		return "", fmt.Errorf("resolving folder %q under %q: %w", ref, defaultFolderTitle, err)
	}
	return child.UID, nil
}

func annotationValue(annotations map[string]string, key string) string {
	if annotations == nil {
		return ""
	}
	return annotations[key]
}

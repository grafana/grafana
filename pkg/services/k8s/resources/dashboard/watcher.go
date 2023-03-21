package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	enabled        bool
	log            log.Logger
	dashboardStore database.DashboardSQLStore
	folders        folder.FolderStore
}

func ProvideWatcher(
	features featuremgmt.FeatureToggles,
	dashboardStore database.DashboardSQLStore,
	userService user.Service,
	accessControlService accesscontrol.Service,
	folders folder.FolderStore,
) (*watcher, error) {
	c := watcher{
		enabled:        features.IsEnabled(featuremgmt.FlagK8S),
		log:            log.New("k8s.dashboards.controller"),
		dashboardStore: dashboardStore,
		folders:        folders,
	}
	return &c, nil
}

func (c *watcher) Add(ctx context.Context, dash *Dashboard) error {
	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
	data.Set("resourceVersion", dash.ResourceVersion)
	uid := data.Get("uid").MustString()
	if uid == "" {
		uid = dash.GetName()
		data.Set("uid", uid)
	} else if dash.GetName() != crd.GrafanaUIDToK8sName(uid) {
		return fmt.Errorf("UID and k8s name do not match")
	}
	c.log.Debug("adding dashboard", "dash", uid)

	data.Del("id") // ignore any internal id
	anno := crd.CommonAnnotations{}
	anno.Read(dash.Annotations)

	if anno.CreatedAt < 1 {
		anno.CreatedAt = time.Now().UnixMilli()
	}
	if anno.UpdatedAt < 1 {
		anno.UpdatedAt = time.Now().UnixMilli()
	}

	save := &dashboards.Dashboard{
		UID:       uid,
		OrgID:     crd.GetOrgIDFromNamespace(dash.Namespace),
		Data:      data,
		Created:   time.UnixMilli(anno.CreatedAt),
		CreatedBy: anno.CreatedBy,
		Updated:   time.UnixMilli(anno.UpdatedAt),
		UpdatedBy: anno.UpdatedBy,

		// Plugin provisioning
		PluginID: anno.PluginID,
	}
	save.UpdateSlug()

	if anno.FolderUID != "" {
		f, err := c.folders.GetFolderByUID(ctx, save.OrgID, anno.FolderUID)
		if err != nil {
			return err // error getting folder?
		}
		save.FolderID = f.ID
	}

	var p *dashboards.DashboardProvisioning

	if anno.OriginName != "" {
		p = &dashboards.DashboardProvisioning{
			Name:       anno.OriginName,
			ExternalID: anno.OriginPath,
			CheckSum:   anno.OriginKey,
			Updated:    anno.OriginTime,
		}
	}

	out, err := c.dashboardStore.SaveDashboardWithMetadata(ctx, anno.Message, save, p)
	if out != nil {
		fmt.Printf("ADDED: %s/%s\n", out.UID, out.Slug)
	}

	// js, _ := json.MarshalIndent(out, "", "  ")
	// fmt.Printf("-------- WATCHER ---------")
	// fmt.Printf("%s", string(js))
	return err
}

func (c *watcher) Update(ctx context.Context, oldObj, newObj *Dashboard) error {
	return c.Add(ctx, newObj) // no difference between add+update
}

func (c *watcher) Delete(ctx context.Context, dash *Dashboard) error {
	anno := crd.CommonAnnotations{}
	anno.Read(dash.Annotations)

	orgID := crd.GetOrgIDFromNamespace(dash.Namespace)
	existing, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   dash.Name, // Assumes same as UID!
		OrgID: orgID,
	})

	// no dashboard found, nothing to delete
	if err != nil {
		return nil
	}

	return c.dashboardStore.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{
		ID:    existing.ID,
		OrgID: existing.OrgID,
	})
}

// only run service if feature toggle is enabled
func (c *watcher) IsDisabled() bool {
	return !c.enabled
}

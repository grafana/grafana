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
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
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
		log:            log.New("k8s.dashboards.controller"),
		dashboardStore: dashboardStore,
		folders:        folders,
	}
	return &c, nil
}

// UID is currently saved in the dashboard body and the name may be a hash
func getValidUID(dash *Dashboard) (string, error) {
	uid := ""
	if dash.Spec.Uid != nil {
		uid = *dash.Spec.Uid
	}
	if uid == "" {
		uid = dash.GetName()
	} else if dash.GetName() != GrafanaUIDToK8sName(uid) {
		return uid, fmt.Errorf("UID and k8s name do not match")
	}
	return uid, nil
}

func (c *watcher) Add(ctx context.Context, dash *Dashboard) error {
	uid, err := getValidUID(dash)
	if err != nil {
		return err
	}
	c.log.Debug("adding dashboard", "dash", uid)
	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
	data.Set("resourceVersion", dash.ResourceVersion)

	data.Del("id") // ignore any internal id
	anno := CommonAnnotations{}
	anno.Read(dash.Annotations)
	if anno.CreatedAt < 1 {
		anno.CreatedAt = time.Now().UnixMilli()
	}
	if anno.UpdatedAt < 1 {
		anno.UpdatedAt = time.Now().UnixMilli()
	}

	save := &dashboards.Dashboard{
		OrgID:     GetOrgIDFromNamespace(dash.Namespace),
		Data:      data,
		Created:   time.UnixMilli(anno.CreatedAt),
		CreatedBy: anno.CreatedBy,
		Updated:   time.UnixMilli(anno.UpdatedAt),
		UpdatedBy: anno.UpdatedBy,

		// Plugin provisioning
		PluginID: anno.PluginID,
	}
	save.SetUID(uid)
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
		c.log.Debug("added", "dash", out.UID, "slug", out.Slug)
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
	anno := CommonAnnotations{}
	anno.Read(dash.Annotations)

	uid, err := getValidUID(dash)
	if err != nil {
		return err
	}

	existing, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   uid, // Assumes same as UID!
		OrgID: GetOrgIDFromNamespace(dash.Namespace),
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

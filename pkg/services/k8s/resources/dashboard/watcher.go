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
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	enabled        bool
	log            log.Logger
	dashboardStore database.DashboardSQLStore
}

func ProvideWatcher(
	features featuremgmt.FeatureToggles,
	dashboardStore database.DashboardSQLStore,
	userService user.Service,
	accessControlService accesscontrol.Service,
) (*watcher, error) {
	c := watcher{
		enabled:        features.IsEnabled(featuremgmt.FlagK8S),
		log:            log.New("k8s.dashboards.controller"),
		dashboardStore: dashboardStore,
	}
	return &c, nil
}

func (c *watcher) Add(ctx context.Context, dash *Dashboard) error {
	c.log.Debug("adding dashboard", "dash", dash)

	js, _ := json.MarshalIndent(dash, "", "  ")
	fmt.Printf("-------- WATCHER ---------")
	fmt.Printf("%s", string(js))

	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
	data.Set("resourceVersion", dash.ResourceVersion)

	cmd := dashboards.SaveDashboardCommand{
		Dashboard: data,
	}
	anno := entityAnnotations{}
	anno.Read(dash.Annotations)

	cmd.UserID = anno.UpdatedBy    // UserID       int64            `json:"userId" xorm:"user_id"`
	cmd.Overwrite = true           // Overwrite    bool             `json:"overwrite"`
	cmd.Message = anno.Message     // Message      string           `json:"message"`
	cmd.OrgID = anno.OrgID         // OrgID        int64            `json:"-" xorm:"org_id"`
	cmd.RestoredFrom = 0           // RestoredFrom int              `json:"-"`
	cmd.PluginID = anno.PluginID   // PluginID     string           `json:"-" xorm:"plugin_id"`
	cmd.FolderID = anno.FolderID   // FolderID     int64            `json:"folderId" xorm:"folder_id"`
	cmd.FolderUID = anno.FolderUID // FolderUID    string           `json:"folderUid" xorm:"folder_uid"`
	cmd.IsFolder = false           // IsFolder     bool             `json:"isFolder"`
	cmd.UpdatedAt = time.UnixMilli(anno.UpdatedAt)

	js, _ = json.MarshalIndent(cmd, "", "  ")
	fmt.Printf("-------- COMMAND BEFORE final save ---------")
	fmt.Printf("%s", string(js))

	if anno.OriginKey == "" {
		_, err = c.dashboardStore.SaveDashboard(ctx, cmd)
	} else {
		p := &dashboards.DashboardProvisioning{
			Name:        anno.OriginName,
			ExternalID:  anno.OriginPath,
			CheckSum:    anno.OriginKey,
			Updated:     anno.OriginTime,
			DashboardID: cmd.Dashboard.Get("id").MustInt64(0), // :()
		}
		_, err = c.dashboardStore.SaveProvisionedDashboard(ctx, cmd, p)
	}
	return err
}

func (c *watcher) Update(ctx context.Context, oldObj, newObj *Dashboard) error {
	return c.Add(ctx, newObj) // no difference between add+update
}

func (c *watcher) Delete(ctx context.Context, dash *Dashboard) error {
	anno := entityAnnotations{}
	anno.Read(dash.Annotations)

	existing, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   dash.Name, // Assumes same as UID!
		OrgID: anno.OrgID,
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

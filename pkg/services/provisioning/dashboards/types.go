package dashboards

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type config struct {
	Name                  string
	Type                  string
	OrgID                 int64
	Folder                string
	FolderUID             string
	Editable              bool
	Options               map[string]interface{}
	DisableDeletion       bool
	UpdateIntervalSeconds int64
	AllowUIUpdates        bool
}

type configV0 struct {
	Name                  string                 `json:"name" yaml:"name"`
	Type                  string                 `json:"type" yaml:"type"`
	OrgID                 int64                  `json:"org_id" yaml:"org_id"`
	Folder                string                 `json:"folder" yaml:"folder"`
	FolderUID             string                 `json:"folderUid" yaml:"folderUid"`
	Editable              bool                   `json:"editable" yaml:"editable"`
	Options               map[string]interface{} `json:"options" yaml:"options"`
	DisableDeletion       bool                   `json:"disableDeletion" yaml:"disableDeletion"`
	UpdateIntervalSeconds int64                  `json:"updateIntervalSeconds" yaml:"updateIntervalSeconds"`
	AllowUIUpdates        bool                   `json:"allowUiUpdates" yaml:"allowUiUpdates"`
}

type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type configV1 struct {
	Providers []*configs `json:"providers" yaml:"providers"`
}

type configs struct {
	Name                  values.StringValue `json:"name" yaml:"name"`
	Type                  values.StringValue `json:"type" yaml:"type"`
	OrgID                 values.Int64Value  `json:"orgId" yaml:"orgId"`
	Folder                values.StringValue `json:"folder" yaml:"folder"`
	FolderUID             values.StringValue `json:"folderUid" yaml:"folderUid"`
	Editable              values.BoolValue   `json:"editable" yaml:"editable"`
	Options               values.JSONValue   `json:"options" yaml:"options"`
	DisableDeletion       values.BoolValue   `json:"disableDeletion" yaml:"disableDeletion"`
	UpdateIntervalSeconds values.Int64Value  `json:"updateIntervalSeconds" yaml:"updateIntervalSeconds"`
	AllowUIUpdates        values.BoolValue   `json:"allowUiUpdates" yaml:"allowUiUpdates"`
}

func createDashboardJSON(data *simplejson.Json, lastModified time.Time, cfg *config, folderID int64) (*dashboards.SaveDashboardDTO, error) {
	dash := &dashboards.SaveDashboardDTO{}
	dash.Dashboard = models.NewDashboardFromJson(data)
	dash.UpdatedAt = lastModified
	dash.Overwrite = true
	dash.OrgId = cfg.OrgID
	dash.Dashboard.OrgId = cfg.OrgID
	dash.Dashboard.FolderId = folderID

	if dash.Dashboard.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	return dash, nil
}

func mapV0ToDashboardsAsConfig(v0 []*configV0) ([]*config, error) {
	var r []*config
	seen := make(map[string]bool)

	for _, v := range v0 {
		if _, ok := seen[v.Name]; ok {
			return nil, fmt.Errorf("dashboard name %q is not unique", v.Name)
		}
		seen[v.Name] = true

		r = append(r, &config{
			Name:                  v.Name,
			Type:                  v.Type,
			OrgID:                 v.OrgID,
			Folder:                v.Folder,
			FolderUID:             v.FolderUID,
			Editable:              v.Editable,
			Options:               v.Options,
			DisableDeletion:       v.DisableDeletion,
			UpdateIntervalSeconds: v.UpdateIntervalSeconds,
			AllowUIUpdates:        v.AllowUIUpdates,
		})
	}

	return r, nil
}

func (dc *configV1) mapToDashboardsAsConfig() ([]*config, error) {
	var r []*config
	seen := make(map[string]bool)

	for _, v := range dc.Providers {
		if _, ok := seen[v.Name.Value()]; ok {
			return nil, fmt.Errorf("dashboard name %q is not unique", v.Name.Value())
		}
		seen[v.Name.Value()] = true

		r = append(r, &config{
			Name:                  v.Name.Value(),
			Type:                  v.Type.Value(),
			OrgID:                 v.OrgID.Value(),
			Folder:                v.Folder.Value(),
			FolderUID:             v.FolderUID.Value(),
			Editable:              v.Editable.Value(),
			Options:               v.Options.Value(),
			DisableDeletion:       v.DisableDeletion.Value(),
			UpdateIntervalSeconds: v.UpdateIntervalSeconds.Value(),
			AllowUIUpdates:        v.AllowUIUpdates.Value(),
		})
	}

	return r, nil
}

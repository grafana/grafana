package ualert

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/slugify"
)

type dashboard struct {
	Id       int64
	Uid      string
	Slug     string
	OrgId    int64
	GnetId   int64
	Version  int
	PluginId string

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	FolderId  int64
	IsFolder  bool
	HasACL    bool `xorm:"has_acl"`

	Title string
	Data  *simplejson.Json
}

func (d *dashboard) setUid(uid string) {
	d.Uid = uid
	d.Data.Set("uid", uid)
}

func (d *dashboard) setVersion(version int) {
	d.Version = version
	d.Data.Set("version", version)
}

// UpdateSlug updates the slug
func (d *dashboard) updateSlug() {
	title := d.Data.Get("title").MustString()
	d.Slug = slugify.Slugify(title)
}

func newDashboardFromJson(data *simplejson.Json) *dashboard {
	dash := &dashboard{}
	dash.Data = data
	dash.Title = dash.Data.Get("title").MustString()
	dash.updateSlug()
	update := false

	if id, err := dash.Data.Get("id").Float64(); err == nil {
		dash.Id = int64(id)
		update = true
	}

	if uid, err := dash.Data.Get("uid").String(); err == nil {
		dash.Uid = uid
		update = true
	}

	if version, err := dash.Data.Get("version").Float64(); err == nil && update {
		dash.Version = int(version)
		dash.Updated = time.Now()
	} else {
		dash.Data.Set("version", 0)
		dash.Created = time.Now()
		dash.Updated = time.Now()
	}

	if gnetId, err := dash.Data.Get("gnetId").Float64(); err == nil {
		dash.GnetId = int64(gnetId)
	}

	return dash
}

type saveFolderCommand struct {
	Dashboard    *simplejson.Json `json:"dashboard" binding:"Required"`
	UserId       int64            `json:"userId"`
	Message      string           `json:"message"`
	OrgId        int64            `json:"-"`
	RestoredFrom int              `json:"-"`
	PluginId     string           `json:"-"`
	FolderId     int64            `json:"folderId"`
	IsFolder     bool             `json:"isFolder"`
}

// GetDashboardModel turns the command into the saveable model
func (cmd *saveFolderCommand) getDashboardModel() *dashboard {
	dash := newDashboardFromJson(cmd.Dashboard)
	userId := cmd.UserId

	if userId == 0 {
		userId = -1
	}

	dash.UpdatedBy = userId
	dash.OrgId = cmd.OrgId
	dash.PluginId = cmd.PluginId
	dash.IsFolder = cmd.IsFolder
	dash.FolderId = cmd.FolderId
	dash.updateSlug()
	return dash
}

package dashboards

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetDashboardUrl(t *testing.T) {
	origAppURL := setting.AppUrl
	t.Cleanup(func() { setting.AppUrl = origAppURL })

	setting.AppUrl = ""
	url := GetDashboardURL("uid", "my-dashboard")
	assert.Equal(t, "/d/uid/my-dashboard", url)
}

func TestGetFullDashboardUrl(t *testing.T) {
	origAppURL := setting.AppUrl
	t.Cleanup(func() { setting.AppUrl = origAppURL })

	setting.AppUrl = "http://grafana.local/"
	url := GetFullDashboardURL("uid", "my-dashboard")
	assert.Equal(t, "http://grafana.local/d/uid/my-dashboard", url)
}

func TestDashboard_UpdateSlug(t *testing.T) {
	dashboard := NewDashboard("Grafana Play Home")
	assert.Equal(t, "grafana-play-home", dashboard.Slug)

	dashboard.UpdateSlug()
	assert.Equal(t, "grafana-play-home", dashboard.Slug)
}

func TestNewDashboardFromJson(t *testing.T) {
	json := simplejson.New()
	json.Set("title", "test dash")
	json.Set("tags", "")

	dash := NewDashboardFromJson(json)
	assert.Equal(t, "test dash", dash.Title)
	require.Empty(t, dash.GetTags())
}

func TestSaveDashboardCommand_GetDashboardModel(t *testing.T) {
	t.Run("should set IsFolder", func(t *testing.T) {
		json := simplejson.New()
		json.Set("title", "test dash")

		cmd := &SaveDashboardCommand{Dashboard: json, IsFolder: true}
		dash := cmd.GetDashboardModel()

		assert.Equal(t, "test dash", dash.Title)
		assert.True(t, dash.IsFolder)
	})

	t.Run("should set FolderId", func(t *testing.T) {
		json := simplejson.New()
		json.Set("title", "test dash")

		cmd := &SaveDashboardCommand{Dashboard: json, FolderID: 1}
		dash := cmd.GetDashboardModel()

		assert.Equal(t, int64(1), dash.FolderID)
	})
}

func TestSlugifyTitle(t *testing.T) {
	testCases := map[string]string{
		"Grafana Play Home": "grafana-play-home",
		"snöräv-över-ån":    "snorav-over-an",
		"漢字":                "5ryi5a2X",    // "han-zi",      // Hanzi for hanzi
		"🇦🇶":                "8J-HpvCfh7Y", // flag of Antarctica-emoji, using fallback
		"𒆠":                 "8JKGoA",      // cuneiform Ki, using fallback
	}

	for input, expected := range testCases {
		t.Run(input, func(t *testing.T) {
			slug := slugify.Slugify(input)
			assert.Equal(t, expected, slug)
		})
	}
}

func TestResourceConversion(t *testing.T) {
	body := simplejson.New()
	body.Set("title", "test dash")
	body.Set("tags", []string{"hello", "world"})

	dash := NewDashboardFromJson(body)
	dash.SetUID("TheUID")
	dash.SetVersion(10)
	dash.Created = time.UnixMilli(946713600000).UTC()  // 2000-01-01
	dash.Updated = time.UnixMilli(1262332800000).UTC() // 2010-01-01
	dash.CreatedBy = 10
	dash.UpdatedBy = 11
	dash.PluginID = "plugin-xyz"
	dash.FolderID = 1234
	dash.SetID(12345) // should be removed in resource version

	dst := dash.ToResource()
	require.Equal(t, int64(12345), dash.ID)
	require.Equal(t, int64(12345), dash.Data.Get("id").MustInt64(0))

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"apiVersion": "v0.0-alpha",
		"kind": "Dashboard",
		"metadata": {
		  "name": "TheUID",
		  "resourceVersion": "10",
		  "creationTimestamp": "2000-01-01T08:00:00Z",
		  "annotations": {
			"grafana.com/createdBy": "user:10",
			"grafana.com/folder": "folder:1234",
			"grafana.com/origin/key": "plugin-xyz",
			"grafana.com/origin/name": "plugin",
			"grafana.com/slug": "test-dash",
			"grafana.com/updatedBy": "user:11",
			"grafana.com/updatedTimestamp": "2010-01-01T08:00:00Z"
		  }
		},
		"spec": {
		  "tags": [
			"hello",
			"world"
		  ],
		  "title": "test dash"
		}
	  }`, string(out))
}

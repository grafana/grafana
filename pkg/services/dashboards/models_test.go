package dashboards

import (
	"testing"

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

		cmd := &SaveDashboardCommand{Dashboard: json, FolderUID: "1"}
		dash := cmd.GetDashboardModel()

		assert.Equal(t, "1", dash.FolderUID)
	})
}

func TestSlugifyTitle(t *testing.T) {
	testCases := map[string]string{
		"Grafana Play Home": "grafana-play-home",
		"snöräv-över-ån":    "snorav-over-an",
		"漢字":                "e6bca2-e5ad97",     // "han-zi",      // Hanzi for hanzi
		"🇦🇶":                "f09f87a6-f09f87b6", // flag of Antarctica-emoji, using fallback
		"𒆠":                 "f09286a0",          // cuneiform Ki, using fallback
	}

	for input, expected := range testCases {
		t.Run(input, func(t *testing.T) {
			slug := slugify.Slugify(input)
			assert.Equal(t, expected, slug)
		})
	}
}

func TestParseK8sDashboard(t *testing.T) {
	t.Run("should parse valid K8s dashboard with all fields", func(t *testing.T) {
		data := simplejson.NewFromAny(map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v2alpha1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":       "test-dashboard-uid",
				"namespace":  "org-123",
				"generation": int64(5),
				"labels": map[string]interface{}{
					"grafana.app/deprecatedInternalID": "456",
				},
				"annotations": map[string]interface{}{
					"grafana.app/folder": "test-folder-uid",
				},
			},
			"spec": map[string]interface{}{
				"title":  "Test Dashboard",
				"gnetId": float64(12345),
			},
		})

		dash := parseK8sDashboard(data)
		assert.Equal(t, "dashboard.grafana.app/v2alpha1", dash.APIVersion)
		assert.Equal(t, int64(123), dash.OrgID)
		assert.Equal(t, "test-dashboard-uid", dash.UID)
		assert.Equal(t, "Test Dashboard", dash.Title)
		assert.Equal(t, "test-dashboard", dash.Slug)
		assert.Equal(t, "test-folder-uid", dash.FolderUID)
		assert.Equal(t, int64(12345), dash.GnetID)
		assert.Equal(t, "test-dashboard-uid", dash.Data.Get("uid").MustString())
		assert.Equal(t, int64(5), dash.Data.Get("version").MustInt64())
		assert.Equal(t, int64(456), dash.Data.Get("id").MustInt64())
		assert.False(t, dash.Updated.IsZero())
		assert.True(t, dash.Created.IsZero())
	})

	t.Run("should handle invalid input (not a map)", func(t *testing.T) {
		data := simplejson.NewFromAny("invalid string")
		dash := parseK8sDashboard(data)
		assert.Empty(t, dash.UID)
		assert.Empty(t, dash.Title) // this will fail later in the provisioning chain because its empty
		assert.Empty(t, dash.APIVersion)
		assert.Nil(t, dash.Data)
	})
}

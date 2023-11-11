package dashboards

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func TestResourceConversion(t *testing.T) {
	body := simplejson.New()
	body.Set("title", "test dash")
	body.Set("tags", []string{"hello", "world"})

	dash := dashboardssvc.NewDashboardFromJson(body)
	dash.SetUID("TheUID")
	dash.SetVersion(10)
	dash.Created = time.UnixMilli(946713600000).UTC()  // 2000-01-01
	dash.Updated = time.UnixMilli(1262332800000).UTC() // 2010-01-01
	dash.CreatedBy = 10
	dash.UpdatedBy = 11
	dash.OrgID = 5678
	dash.PluginID = "plugin-xyz"
	dash.FolderUID = "FABC"
	dash.SetID(12345) // should be removed in resource version

	dst := convertToK8sResource(dash, request.GetNamespaceMapper(nil))
	require.Equal(t, int64(12345), dash.ID)
	require.Equal(t, int64(12345), dash.Data.Get("id").MustInt64(0))

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"metadata": {
		  "name": "TheUID",
		  "namespace": "org-5678",
		  "resourceVersion": "1262332800000",
		  "creationTimestamp": "2000-01-01T08:00:00Z",
		  "annotations": {
			"grafana.app/createdBy": "10",
			"grafana.app/folder": "FABC",
			"grafana.app/originKey": "plugin-xyz",
			"grafana.app/originName": "plugin",
			"grafana.app/slug": "test-dash",
			"grafana.app/updatedBy": "11",
			"grafana.app/updatedTimestamp": "2000-01-01T08:00:00Z"
		  }
		},
		"spec": {
		  "id": 12345,
		  "tags": [
			"hello",
			"world"
		  ],
		  "title": "test dash",
		  "uid": "TheUID",
		  "version": 10
		}
	  }`, string(out))
}

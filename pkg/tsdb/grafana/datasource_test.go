package grafana

import (
	"encoding/json"
	"path"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func asJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func TestReadFolderListing(t *testing.T) {
	ds := GrafanaDatasource{
		StaticRootPath: "../../../public",
		OKRoots: []string{
			"testdata",
			"img/icons",
		},
	}

	dr := ds.doListQuery(backend.DataQuery{
		QueryType: "x",
		JSON: asJSON(ListQueryModel{
			Path: "testdata",
		}),
	})
	err := experimental.CheckGoldenDataResponse(path.Join("testdata", "list.golden.txt"), &dr, true)
	require.NoError(t, err)
}

func TestReadCSVFile(t *testing.T) {
	ds := GrafanaDatasource{
		StaticRootPath: "../../../public",
		OKRoots: []string{
			"testdata",
			"img/icons",
		},
	}

	dr := ds.doReadQuery(backend.DataQuery{
		QueryType: "x",
		JSON: asJSON(ListQueryModel{
			Path: "testdata/js_libraries.csv",
		}),
	})
	err := experimental.CheckGoldenDataResponse(path.Join("testdata", "jslib.golden.txt"), &dr, true)
	require.NoError(t, err)
}

package grafanads

import (
	"encoding/json"
	"path"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func asJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func TestReadFolderListing(t *testing.T) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagFileStoreApi, true)
	cfg := &setting.Cfg{StaticRootPath: "./../../../public"}
	fs, err := filestorage.ProvideService(features, cfg)
	require.NoError(t, err)

	ds := newService(&setting.Cfg{StaticRootPath: "../../../public"}, searchV2.NewStubSearchService(), fs)
	dr := ds.doListQuery(backend.DataQuery{
		QueryType: "x",
		JSON: asJSON(listQueryModel{
			Path: filestorage.Join("public", "testdata"),
		}),
	})
	err = experimental.CheckGoldenDataResponse(path.Join("testdata", "list.golden.txt"), &dr, true)
	require.NoError(t, err)
}

func TestReadCSVFile(t *testing.T) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagFileStoreApi, true)
	cfg := &setting.Cfg{StaticRootPath: "./../../../public"}
	fs, err := filestorage.ProvideService(features, cfg)
	require.NoError(t, err)

	ds := newService(&setting.Cfg{StaticRootPath: "../../../public"}, searchV2.NewStubSearchService(), fs)
	dr := ds.doReadQuery(backend.DataQuery{
		QueryType: "x",
		JSON: asJSON(readQueryModel{
			Path: "testdata/js_libraries.csv",
		}),
	})
	err = experimental.CheckGoldenDataResponse(path.Join("testdata", "jslib.golden.txt"), &dr, true)
	require.NoError(t, err)
}

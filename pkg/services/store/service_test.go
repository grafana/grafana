package store

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/stretchr/testify/require"
)

var (
	dummyUser = &models.SignedInUser{OrgId: 1}
)

func TestListFiles(t *testing.T) {
	publicRoot, err := filepath.Abs("../../../public")
	require.NoError(t, err)
	roots := []storageRuntime{
		newDiskStorage("public", "Public static files", &StorageLocalDiskConfig{
			Path: publicRoot,
			Roots: []string{
				"/testdata/",
				"/img/icons/",
				"/img/bg/",
				"/gazetteer/",
				"/maps/",
				"/upload/",
			},
		}).setReadOnly(true).setBuiltin(true),
	}

	store := newStandardStorageService(roots, func(orgId int64) []storageRuntime {
		return make([]storageRuntime, 0)
	})
	frame, err := store.List(context.Background(), dummyUser, "public/testdata")
	require.NoError(t, err)

	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata.golden", frame.Frame, true)

	file, err := store.Read(context.Background(), dummyUser, "public/testdata/js_libraries.csv")
	require.NoError(t, err)
	require.NotNil(t, file)

	testDsFrame, err := testdatasource.LoadCsvContent(bytes.NewReader(file.Contents), file.Name)
	require.NoError(t, err)
	experimental.CheckGoldenJSONFrame(t, "testdata", "public_testdata_js_libraries.golden", testDsFrame, true)
}

func TestUpload(t *testing.T) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagStorageLocalUpload)
	path, err := os.Getwd()
	require.NoError(t, err)
	cfg := &setting.Cfg{AppURL: "http://localhost:3000/", DataPath: path}
	s := ProvideService(sqlstore.InitTestDB(t), features, cfg)
	request := UploadRequest{
		EntityType: EntityTypeImage,
		Contents:   make([]byte, 0),
		Path:       "resources/myFile.jpg",
		MimeType:   "image/jpg",
	}
	err = s.Upload(context.Background(), dummyUser, &request)
	require.NoError(t, err)
}

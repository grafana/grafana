package filestorage

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

const (
	ServiceName = "FileStorage"
)

func ProvideService(features featuremgmt.FeatureToggles, cfg *setting.Cfg) (FileStorage, error) {
	// TODO: initialize deps if needed for s3/gcs
	return &dummyFileStorage{}, nil
}

package options

import (
	"fmt"
	"net"

	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type StorageType string

const (
	StorageTypeFile        StorageType = "file"
	StorageTypeEtcd        StorageType = "etcd"
	StorageTypeUnified     StorageType = "unified"
	StorageTypeUnifiedGrpc StorageType = "unified-grpc"

	// Deprecated: legacy is a shim that is no longer necessary
	StorageTypeLegacy StorageType = "legacy"
)

type StorageOptions struct {
	// The desired storage type
	StorageType StorageType

	// For unified-grpc, the address is required
	Address string

	// For file storage, this is the requested path
	DataPath string

	// Optional blob storage connection string
	// file:///path/to/dir
	// gs://my-bucket (using default credentials)
	// s3://my-bucket?region=us-west-1 (using default credentials)
	// azblob://my-container
	BlobStoreURL string

	// {resource}.{group} = 1|2|3|4
	UnifiedStorageConfig map[string]setting.UnifiedStorageConfig
}

func NewStorageOptions() *StorageOptions {
	return &StorageOptions{
		StorageType: StorageTypeUnified,
		Address:     "localhost:10000",
	}
}

func (o *StorageOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar((*string)(&o.StorageType), "grafana-apiserver-storage-type", string(o.StorageType), "Storage type")
	fs.StringVar(&o.DataPath, "grafana-apiserver-storage-path", o.DataPath, "Storage path for file storage")
	fs.StringVar(&o.Address, "grafana-apiserver-storage-address", o.Address, "Remote grpc address endpoint")
}

func (o *StorageOptions) Validate() []error {
	errs := []error{}
	switch o.StorageType {
	// nolint:staticcheck
	case StorageTypeLegacy:
		// no-op
	case StorageTypeFile, StorageTypeEtcd, StorageTypeUnified, StorageTypeUnifiedGrpc:
		// no-op
	default:
		// nolint:staticcheck
		errs = append(errs, fmt.Errorf("--grafana-apiserver-storage-type must be one of %s, %s, %s, %s, %s", StorageTypeFile, StorageTypeEtcd, StorageTypeLegacy, StorageTypeUnified, StorageTypeUnifiedGrpc))
	}

	if _, _, err := net.SplitHostPort(o.Address); err != nil {
		errs = append(errs, fmt.Errorf("--grafana-apiserver-storage-address must be a valid network address: %v", err))
	}

	// Only works for single tenant grafana right now
	if o.BlobStoreURL != "" && o.StorageType != StorageTypeUnified {
		errs = append(errs, fmt.Errorf("blob storage is only valid with unified storage"))
	}
	return errs
}

func (o *StorageOptions) ApplyTo(serverConfig *genericapiserver.RecommendedConfig, etcdOptions *options.EtcdOptions) error {
	// TODO: move storage setup here
	return nil
}

// EnforceFeatureToggleAfterMode1 makes sure there is a feature toggle set for resources with DualWriterMode > 1.
// This is needed to ensure that we use the K8s client before enabling dual writing.
func (o *StorageOptions) EnforceFeatureToggleAfterMode1(features featuremgmt.FeatureToggles) error {
	// nolint:staticcheck
	if o.StorageType != StorageTypeLegacy {
		for rg, s := range o.UnifiedStorageConfig {
			if s.DualWriterMode > 1 {
				switch rg {
				case "playlists.playlist.grafana.app":
					if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesPlaylists) {
						return fmt.Errorf("feature toggle FlagKubernetesPlaylists to be set")
					}
				}
			}
		}
	}
	return nil
}

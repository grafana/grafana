package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

var (
	ErrKeeperNotFound = errors.New("keeper not found")
)

// KeeperMetadataStorage is the interface for wiring and dependency injection.
type KeeperMetadataStorage interface {
	Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
}

// KeeperType represents the type of a Keeper.
type KeeperType string

const (
	SQLKeeperType       KeeperType = "sql"
	AWSKeeperType       KeeperType = "aws"
	AzureKeeperType     KeeperType = "azure"
	GCPKeeperType       KeeperType = "gcp"
	HashiCorpKeeperType KeeperType = "hashicorp"
)

// ExternalID represents either the secure value's GUID or ref (in case of external secret references).
// This is saved in the secure_value metadata storage as `external_id`.
// TODO: this does not belong in the k8s spec, but it is used by us internally. Place it somewhere appropriate.
type ExternalID string

func (s ExternalID) String() string {
	return string(s)
}

// Keeper is the interface for secret keepers.
type Keeper interface {
	Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (ExternalID, error)
	Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID, exposedValueOrRef string) error
	Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID) (secretv0alpha1.ExposedSecureValue, error)
	Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID) error
}

const (
	DefaultSQLKeeper = "kp-default-sql"
)

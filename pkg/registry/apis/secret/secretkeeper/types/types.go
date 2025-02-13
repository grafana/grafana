package types

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

var (
	ErrSecretNotFound = errors.New("secret not found")
	DefaultSQLKeeper  = "kp-default-sql"
)

type KeeperType string

const (
	SQLKeeperType       KeeperType = "sql"
	AWSKeeperType       KeeperType = "aws"
	AzureKeeperType     KeeperType = "azure"
	GCPKeeperType       KeeperType = "gcp"
	HashiCorpKeeperType KeeperType = "hashicorp"
)

type Keeper interface {
	Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (ExternalID, error)
	Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID, exposedValueOrRef string) error
	Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID) (secretv0alpha1.ExposedSecureValue, error)
	Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID ExternalID) error
}

// ExternalID represents either the secure value's GUID or ref (in case of external secret references).
// This is saved in the secure_value metadata storage as `external_id`.
// TODO: this does not belong in the k8s spec, but it is used by us internally. Place it somewhere appropriate.
type ExternalID string

func (s ExternalID) String() string {
	return string(s)
}

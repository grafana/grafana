package keeper

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

type SQLKeeper struct {
}

var _ secret.Keeper = (*SQLKeeper)(nil)

// TODO pass in SQL
func NewSQLKeeper(ctx context.Context) (*SQLKeeper, error) {
	return &SQLKeeper{}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, exposedValueOrRef string) (secret.ExternalID, error) {
	return "", nil
}

func (s *SQLKeeper) Expose(ctx context.Context, id secret.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	return secretv0alpha1.NewExposedSecureValue(""), nil
}

func (s *SQLKeeper) Delete(ctx context.Context, id secret.ExternalID) error {
	return nil
}

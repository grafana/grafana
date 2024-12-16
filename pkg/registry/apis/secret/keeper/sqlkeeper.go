package keeper

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

type SQLKeeper struct {
}

var _ secret.Keeper = (*SQLKeeper)(nil)

// TODO pass in SQL
func NewSQLKeeper(ctx context.Context) (*SQLKeeper, error) {
	return &SQLKeeper{}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, sv secret.SecureValue) (secret.ManagedSecureValueID, error) {
	return "", nil
}

func (s *SQLKeeper) Expose(ctx context.Context, id secret.ManagedSecureValueID) (secret.ExposedSecureValue, error) {
	return secret.NewExposedSecureValue(""), nil
}

func (s *SQLKeeper) Delete(ctx context.Context, id secret.ManagedSecureValueID) error {
	return nil
}

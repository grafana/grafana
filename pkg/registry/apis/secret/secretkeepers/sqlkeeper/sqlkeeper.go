package sqlkeeper

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

type SQLKeeper struct {
	db db.DB
}

var _ secret.Keeper = (*SQLKeeper)(nil)

func NewSQLKeeper(db db.DB) (*SQLKeeper, error) {
	return &SQLKeeper{db: db}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, exposedValueOrRef string) (secret.ExternalID, error) {
	// TODO: implement me
	return secret.ExternalID("todo-sql-keeper-store"), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, id secret.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	// TODO: implement me
	return secretv0alpha1.NewExposedSecureValue("todo-sql-keeper-exposed"), nil
}

func (s *SQLKeeper) Delete(ctx context.Context, id secret.ExternalID) error {
	// TODO: implement me
	return nil
}

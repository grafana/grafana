package token

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/contracts"
)

type DependencyRegisterer struct{}

func RegisterDependencies(cfg *setting.Cfg, tokenDBMigrator contracts.TokenDBMigrator) (*DependencyRegisterer, error) {
	lockDatabase := cfg.Raw.Section("database").Key("migration_locking").MustBool(true)
	if err := tokenDBMigrator.RunMigrations(context.Background(), lockDatabase); err != nil {
		return nil, fmt.Errorf("running service account token database migrations: %w", err)
	}
	return &DependencyRegisterer{}, nil
}

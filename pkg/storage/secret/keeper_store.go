package secret

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// KeeperStorage is the interface for wiring and dependency injection.
type KeeperStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, namespace, name string) (*secretv0alpha1.Keeper, error)
}

func ProvideKeeperStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (KeeperStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &keeperStorage{}, nil
	}

	// if err := migrateSecretSQL(db.GetEngine(), cfg); err != nil {
	// 	return nil, fmt.Errorf("failed to run migrations: %w", err)
	// }

	return &keeperStorage{db: db}, nil
}

// keeperStorage is the actual implementation of the keeper (metadata) storage.
type keeperStorage struct {
	db db.DB
}

func (s *keeperStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	keeperRow, err := toCreateRow(keeper, uuid.NewString())
	if err != nil {
		return nil, fmt.Errorf("failed to create: %w", err)
	}

	err = s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(keeperRow); err != nil {
			return fmt.Errorf("failed to insert row: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdKeeper, err := keeperRow.toK8s()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *keeperStorage) Read(ctx context.Context, namespace string, name string) (*secretv0alpha1.Keeper, error) {
	keeperRow := Keeper{Name: name, Namespace: namespace}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(&keeperRow)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keeper, err := keeperRow.toK8s()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil

}

func (s *keeperStorage) Update(ctx context.Context, obj *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	// TODO: implement
	return nil, nil
}

func (s *keeperStorage) Delete(ctx context.Context, namespace string, name string) (*secretv0alpha1.Keeper, bool, error) {
	// TODO: implement
	return nil, false, nil
}

func (s *keeperStorage) List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.Keeper, error) {
	// TODO: implement
	return nil, nil
}

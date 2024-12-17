package secret

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"
)

// KeeperStorage is the interface for wiring and dependency injection.
type KeeperStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, namespace string, name string) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, namespace string, name string) error
	List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
}

func ProvideKeeperStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (KeeperStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &keeperStorage{}, nil
	}

	return &keeperStorage{db: db}, nil
}

// keeperStorage is the actual implementation of the keeper (metadata) storage.
type keeperStorage struct {
	db db.DB
}

func (s *keeperStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	row, err := toKeeperCreateRow(keeper, authInfo.GetUID())
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	err = s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(row); err != nil {
			return fmt.Errorf("failed to insert row: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdKeeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *keeperStorage) Read(ctx context.Context, namespace string, name string) (*secretv0alpha1.Keeper, error) {
	_, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	row := &Keeper{Name: name, Namespace: namespace}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(row)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}

		if !found {
			return ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *keeperStorage) Update(ctx context.Context, newKeeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	currentRow := &Keeper{Name: newKeeper.Name, Namespace: newKeeper.Namespace}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(currentRow)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}

		if !found {
			return ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	newRow, err := toKeeperUpdateRow(currentRow, newKeeper, authInfo.GetUID())
	if err != nil {
		return nil, fmt.Errorf("failed to map into update row: %w", err)
	}
	err = s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Update(newRow); err != nil {
			return fmt.Errorf("failed to update row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}
	return keeper, nil
}

func (s *keeperStorage) Delete(ctx context.Context, namespace string, name string) error {
	_, ok := claims.From(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	row := &Keeper{Name: name, Namespace: namespace}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Delete(row); err != nil {
			return fmt.Errorf("failed to delete row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *keeperStorage) List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	_, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}

	keeperRows := make([]*Keeper, 0)

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if err := sess.Where("namespace = ?", namespace).Find(&keeperRows); err != nil {
			return fmt.Errorf("failed to find rows: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keepers := make([]secretv0alpha1.Keeper, 0, len(keeperRows))

	for _, row := range keeperRows {
		keeper, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
		}

		if labelSelector.Matches(labels.Set(keeper.Labels)) {
			keepers = append(keepers, *keeper)
		}
	}

	return &secretv0alpha1.KeeperList{
		Items: keepers,
	}, nil
}

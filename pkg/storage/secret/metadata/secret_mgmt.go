package metadata

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *secureValueStorage) storeInKeeper(ctx context.Context, sv *secretv0alpha1.SecureValue) (keepertypes.ExternalID, error) {
	// TODO: Implement store by ref
	if sv.Spec.Ref != "" {
		return "", fmt.Errorf("store by ref in keeper")
	}

	// Check if keeper is default sql.
	if sv.Spec.Keeper == keepertypes.DefaultSQLKeeper {
		keeper, exists := s.keepers[keepertypes.SQLKeeperType]
		if !exists {
			return "", fmt.Errorf("could not find default keeper")
		}
		externalID, err := keeper.Store(ctx, nil, sv.Namespace, string(sv.Spec.Value))
		if err != nil {
			return "", fmt.Errorf("failed to store in default keeper: %w", err)
		}
		return externalID, err
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, sv.Namespace, sv.Spec.Keeper)
	if err != nil {
		return "", fmt.Errorf("get keeper config: %w", err)
	}

	// Store in keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return "", fmt.Errorf("could not find keeper: %s", keeperType)
	}

	return keeper.Store(ctx, keeperConfig, sv.Namespace, string(sv.Spec.Value))
}

func (s *secureValueStorage) updateInKeeper(ctx context.Context, currRow *secureValueDB, newSV *secretv0alpha1.SecureValue) error {
	// TODO: Implement store by ref
	if newSV.Spec.Ref != "" {
		return fmt.Errorf("store by ref in keeper")
	}

	// Check if an update in keeper is actually needed.
	if newSV.Spec.Value == "" {
		return nil
	}

	if currRow.Keeper != newSV.Spec.Keeper {
		return fmt.Errorf("keeper change not supported")
	}

	// Check if keeper is default sql.
	if currRow.Keeper == keepertypes.DefaultSQLKeeper {
		keeper, exists := s.keepers[keepertypes.SQLKeeperType]
		if !exists {
			return fmt.Errorf("could not find default keeper")
		}
		return keeper.Update(ctx, nil, currRow.Namespace, keepertypes.ExternalID(currRow.ExternalID), string(newSV.Spec.Value))
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, currRow.Namespace, currRow.Keeper)
	if err != nil {
		return fmt.Errorf("get keeper config: %w", err)
	}

	// Store in keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return fmt.Errorf("could not find keeper: %s", keeperType)
	}

	return keeper.Update(ctx, keeperConfig, currRow.Namespace, keepertypes.ExternalID(currRow.ExternalID), string(newSV.Spec.Value))
}

func (s *secureValueStorage) deleteFromKeeper(ctx context.Context, namespace xkube.Namespace, name string) error {
	sv, err := s.readSecureValue(ctx, namespace, name)
	if err != nil {
		return fmt.Errorf("read securevalue: %w", err)
	}

	// Check if keeper is default sql.
	if sv.Keeper == keepertypes.DefaultSQLKeeper {
		keeper, exists := s.keepers[keepertypes.SQLKeeperType]
		if !exists {
			return fmt.Errorf("could not find default keeper")
		}
		return keeper.Delete(ctx, nil, namespace.String(), keepertypes.ExternalID(sv.ExternalID))
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, namespace.String(), sv.Keeper)
	if err != nil {
		return fmt.Errorf("get keeper config: %w", err)
	}

	// Delete from keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return fmt.Errorf("could not find keeper: %s", keeperType)
	}
	return keeper.Delete(ctx, keeperConfig, namespace.String(), keepertypes.ExternalID(sv.ExternalID))
}

func (s *secureValueStorage) readSecureValue(ctx context.Context, namespace xkube.Namespace, name string) (*secureValueDB, error) {
	row := &secureValueDB{Namespace: namespace.String(), Name: name}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(row)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return contracts.ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	return row, nil
}

func (s *secureValueStorage) getKeeperConfig(ctx context.Context, namespace string, name string) (keepertypes.KeeperType, secretv0alpha1.KeeperConfig, error) {
	kp := &keeperDB{Namespace: namespace, Name: name}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(kp)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}
		if !found {
			return contracts.ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return "", nil, fmt.Errorf("db failure: %w", err)
	}

	keeperConfig := toProvider(kp.Type, kp.Payload)
	// TODO: do mapping between keeperDB.Type and KeeperType, but work towards unifing these types
	keeperType := keepertypes.SQLKeeperType

	return keeperType, keeperConfig, nil
}

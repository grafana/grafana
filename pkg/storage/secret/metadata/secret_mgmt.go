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

	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, sv.Namespace, sv.Spec.Keeper)
	if err != nil {
		return "", fmt.Errorf("get keeper config: %w", err)
	}

	// Store in keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return "", fmt.Errorf("could not find keeper: %s", keeperType)
	}

	externalID, err := keeper.Store(ctx, keeperConfig, sv.Namespace, string(sv.Spec.Value))
	if err != nil {
		return "", fmt.Errorf("failed to store in keeper: %w", err)
	}

	return externalID, err
}

func (s *secureValueStorage) updateInKeeper(ctx context.Context, currRow *secureValueDB, newSV *secretv0alpha1.SecureValue) error {
	// TODO: Implement update by ref
	if newSV.Spec.Ref != "" {
		return fmt.Errorf("store by ref in keeper")
	}

	// If value did not change, an update in keeper is not needed.
	if newSV.Spec.Value == "" {
		return nil
	}

	if currRow.Keeper != newSV.Spec.Keeper {
		return fmt.Errorf("keeper change not supported")
	}

	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, currRow.Namespace, currRow.Keeper)
	if err != nil {
		return fmt.Errorf("get keeper config: %w", err)
	}

	// Update in keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return fmt.Errorf("could not find keeper: %s", keeperType)
	}

	return keeper.Update(ctx, keeperConfig, currRow.Namespace, keepertypes.ExternalID(currRow.ExternalID), string(newSV.Spec.Value))
}

func (s *secureValueStorage) deleteFromKeeper(ctx context.Context, namespace xkube.Namespace, name string) error {
	sv := &secureValueDB{Namespace: namespace.String(), Name: name}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(sv)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return contracts.ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

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

func (s *secureValueStorage) getKeeperConfig(ctx context.Context, namespace string, name string) (keepertypes.KeeperType, secretv0alpha1.KeeperConfig, error) {
	// Check if keeper is default sql.
	if name == keepertypes.DefaultSQLKeeper {
		return keepertypes.SQLKeeperType, nil, nil
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
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
	keeperType := toType(kp.Type)

	// TODO: this would be a good place to check if credentials are secure values and load them.

	return keeperType, keeperConfig, nil
}

package encryption

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var (
	ErrEncryptedValueNotFound = errors.New("encrypted value not found")
)

func ProvideEncryptedValueStorage(db db.DB, features featuremgmt.FeatureToggles) (contracts.EncryptedValueStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptedValStorage{}, nil
	}

	return &encryptedValStorage{db: db}, nil
}

type encryptedValStorage struct {
	db db.DB
}

func (s *encryptedValStorage) Create(ctx context.Context, namespace string, encryptedData []byte) (*contracts.EncryptedValue, error) {
	createdTime := time.Now().Unix()
	encryptedValue := &EncryptedValue{
		UID:           uuid.New().String(),
		Namespace:     namespace,
		EncryptedData: encryptedData,
		Created:       createdTime,
		Updated:       createdTime,
	}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(encryptedValue); err != nil {
			return fmt.Errorf("insert row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	return &contracts.EncryptedValue{
		UID:           encryptedValue.UID,
		Namespace:     encryptedValue.Namespace,
		EncryptedData: encryptedValue.EncryptedData,
		Created:       encryptedValue.Created,
		Updated:       encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Update(ctx context.Context, namespace string, uid string, encryptedData []byte) error {
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		updateEncryptedValue := &EncryptedValue{
			EncryptedData: encryptedData,
			Updated:       time.Now().Unix(),
		}
		rowsAffected, err := sess.Where("uid = ? AND namespace = ?", uid, namespace).Update(updateEncryptedValue)
		if err != nil {
			return fmt.Errorf("update row: %w", err)
		}

		if rowsAffected == 0 {
			return ErrEncryptedValueNotFound
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *encryptedValStorage) Get(ctx context.Context, namespace string, uid string) (*contracts.EncryptedValue, error) {
	encryptedValueRow := &EncryptedValue{
		UID:       uid,
		Namespace: namespace,
	}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(encryptedValueRow)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return ErrEncryptedValueNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	return &contracts.EncryptedValue{
		UID:           encryptedValueRow.UID,
		Namespace:     encryptedValueRow.Namespace,
		EncryptedData: encryptedValueRow.EncryptedData,
		Created:       encryptedValueRow.Created,
		Updated:       encryptedValueRow.Updated,
	}, nil
}

func (s *encryptedValStorage) Delete(ctx context.Context, namespace string, uid string) error {
	encryptedValueRow := &EncryptedValue{
		UID:       uid,
		Namespace: namespace,
	}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Delete(encryptedValueRow); err != nil {
			return fmt.Errorf("delete row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

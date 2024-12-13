package secret

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrSecureValueNotFound = errors.New("secure value not found")
)

// SecureValueStorage is the interface for wiring and dependency injection.
type SecureValueStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, namespace, name string) (*secretv0alpha1.SecureValue, error)
}

func ProvideSecureValueStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (SecureValueStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &storage{}, nil
	}

	if err := migrateSecretSQL(db.GetEngine(), cfg); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &storage{db: db}, nil
}

// storage is the actual implementation of the secure value (metadata) storage.
type storage struct {
	db db.DB
}

func (s *storage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	// This should come from the keeper. From this point on, we should not have a need to read value/ref.
	externalID := "TODO"

	a := string(sv.Spec.Value)
	fmt.Printf("\n\nCast it to a string, you can see it! %v\n\n", a)

	exposedSecret := sv.Spec.Value.DangerouslyExposeDecryptedValue()
	fmt.Printf("\n\nSECRET IS EXPOSED!! %v\n\n", exposedSecret)
	_ = exposedSecret // Do something with it

	exposedSecret2 := sv.Spec.Value.DangerouslyExposeDecryptedValue() // this will return empty now
	fmt.Printf("\n\nSECRET IS EXPOSED AGAIN?? %v\n\n", exposedSecret2)

	sv.Spec.Ref = ""

	row, err := toCreateRow(sv, authInfo.GetUID(), externalID)
	if err != nil {
		return nil, fmt.Errorf("failed to create: %w", err)
	}

	err = s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(row); err != nil {
			return fmt.Errorf("failed to insert row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdSecureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdSecureValue, nil
}

func (s *storage) Read(ctx context.Context, namespace, name string) (*secretv0alpha1.SecureValue, error) {
	_, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	row := secureValueDB{Name: name, Namespace: namespace}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(&row)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

// TODO: move this somewhere else!
var (
	// Exclude these annotations
	skipAnnotations = map[string]bool{
		"kubectl.kubernetes.io/last-applied-configuration": true, // force server side apply
		utils.AnnoKeyCreatedBy:                             true,
		utils.AnnoKeyUpdatedBy:                             true,
		utils.AnnoKeyUpdatedTimestamp:                      true,
	}
)

func CleanAnnotations(anno map[string]string) map[string]string {
	copy := make(map[string]string)
	for k, v := range anno {
		if skipAnnotations[k] {
			continue
		}
		copy[k] = v
	}
	return copy
}

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
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"
)

var (
	ErrSecureValueNotFound = errors.New("secure value not found")
)

// SecureValueStorage is the interface for wiring and dependency injection.
type SecureValueStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, namespace, name string) (*secretv0alpha1.SecureValue, error)
	Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Delete(ctx context.Context, namespace, name string) error
	List(ctx context.Context, ns string, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error)
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
	sv.Spec.Value = ""
	sv.Spec.Ref = ""

	row, err := toCreateRow(sv, authInfo.GetUID(), externalID)
	if err != nil {
		return nil, fmt.Errorf("to create row: %w", err)
	}

	err = s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(row); err != nil {
			return fmt.Errorf("insert row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdSecureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return createdSecureValue, nil
}

func (s *storage) Read(ctx context.Context, namespace, name string) (*secretv0alpha1.SecureValue, error) {
	row, err := s.readInternal(ctx, namespace, name)
	if err != nil {
		return nil, fmt.Errorf("read internal: %w", err)
	}

	secureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

func (s *storage) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	currentRow, err := s.readInternal(ctx, newSecureValue.Namespace, newSecureValue.Name)
	if err != nil {
		return nil, fmt.Errorf("read securevalue: %w", err)
	}

	// This should come from the keeper.
	externalID := "TODO2"
	newSecureValue.Spec.Value = ""
	newSecureValue.Spec.Ref = ""

	newRow, err := toUpdateRow(currentRow, newSecureValue, authInfo.GetUID(), externalID)
	if err != nil {
		return nil, fmt.Errorf("to update row: %w", err)
	}

	err = s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Update(newRow); err != nil {
			return fmt.Errorf("update row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValue, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

func (s *storage) Delete(ctx context.Context, namespace string, name string) error {
	_, ok := claims.From(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	// TODO: delete from the keeper!

	// TODO: do we need to delete by GUID? name+namespace is a unique index. It would avoid doing a fetch.
	row := &secureValueDB{Name: name, Namespace: namespace}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: because this is a securevalue, do we care to inform the caller if a row was delete (existed) or not?
		if _, err := sess.Delete(row); err != nil {
			return fmt.Errorf("delete row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *storage) List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	_, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}

	secureValueRows := make([]*secureValueDB, 0)

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if err := sess.Where("namespace = ?", namespace).Find(&secureValueRows); err != nil {
			return fmt.Errorf("find rows: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValues := make([]secretv0alpha1.SecureValue, 0, len(secureValueRows))

	for _, row := range secureValueRows {
		secureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		if labelSelector.Matches(labels.Set(secureValue.Labels)) {
			secureValues = append(secureValues, *secureValue)
		}
	}

	return &secretv0alpha1.SecureValueList{
		Items: secureValues,
	}, nil
}

func (s *storage) readInternal(ctx context.Context, namespace, name string) (*secureValueDB, error) {
	_, ok := claims.From(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	row := &secureValueDB{Name: name, Namespace: namespace}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(row)
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

	return row, nil
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

package sso

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

// ssoStorage is the common interface set of every store the SSOSetting kind uses. The
// decorator embeds it so overriding Create drops no capability.
type ssoStorage interface {
	rest.Storage
	rest.Scoper
	rest.Getter
	rest.Lister
	rest.Creater
	rest.Updater
	rest.GracefulDeleter
	rest.SingularNameProvider
	rest.TableConvertor
}

var (
	_ ssoStorage = (*LegacyStore)(nil)
	_ ssoStorage = (*MTSettingsStore)(nil)
)

// redactingStore redacts secrets in the Create response. LegacyStore.Create returns the raw
// secret so the dual-writer forwards it to MT-Settings; this keeps it out of the response.
type redactingStore struct {
	ssoStorage
}

// NewRedactingStore wraps the SSOSetting store, erroring if it lacks a required capability.
func NewRedactingStore(storage rest.Storage) (rest.Storage, error) {
	inner, ok := storage.(ssoStorage)
	if !ok {
		return nil, fmt.Errorf("sso storage does not implement the expected interface set")
	}
	return &redactingStore{inner}, nil
}

func (s *redactingStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	out, err := s.ssoStorage.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}
	if setting, ok := out.(*iamv0.SSOSetting); ok {
		return redactSecrets(setting), nil
	}
	return out, nil
}

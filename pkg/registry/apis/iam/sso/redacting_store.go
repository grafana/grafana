package sso

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

// ssoStorage is the interface set shared by every store the SSOSetting kind rides on
// (legacy, dual-writer, MT-Settings). The decorator embeds it so overriding Create drops
// no capability the kind serves in any storage mode.
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

// redactingStore redacts the secrets in the Create response. The legacy adapter returns
// the raw admin input on Create, so the dual-writer can send the real secret to
// MT-Settings. That raw object is also the client response. In legacy-only mode it is the
// response directly. The other verbs redact their own responses.
type redactingStore struct {
	ssoStorage
}

// NewRedactingStore wraps the SSOSetting dual-writer. It errors if the storage does not
// expose the expected interface set, which would mean the wrapper drops a capability.
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

package sso

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// ssosettings authorizes against the foreign setting.grafana.app/settings resource.
const (
	SettingsAuthzGroup    = "setting.grafana.app"
	SettingsAuthzResource = "settings"
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

// redactingStore keeps secrets out of the Create response (LegacyStore.Create returns
// the raw secret for the dual-writer to forward) and filters List per-provider, since
// neither dual-writer leg runs the unified per-item filter.
type redactingStore struct {
	ssoStorage
	accessClient authlib.AccessClient
}

// NewRedactingStore wraps the SSOSetting store; a nil accessClient disables List filtering.
func NewRedactingStore(storage rest.Storage, accessClient authlib.AccessClient) (rest.Storage, error) {
	inner, ok := storage.(ssoStorage)
	if !ok {
		return nil, fmt.Errorf("sso storage does not implement the expected interface set")
	}
	return &redactingStore{ssoStorage: inner, accessClient: accessClient}, nil
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

// List drops providers the caller can't read and redacts secrets on the rest.
func (s *redactingStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	out, err := s.ssoStorage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	list, ok := out.(*iamv0.SSOSettingList)
	if !ok {
		return out, nil
	}

	allowed, err := s.providerChecker(ctx)
	if err != nil {
		return nil, err
	}

	// Mutate in place: a DeepCopy panics on legacy non-JSON values (e.g. int64).
	items := list.Items[:0]
	for i := range list.Items {
		if !allowed("auth."+list.Items[i].Name, "") {
			continue
		}
		redactSecretsInPlace(list.Items[i].Spec.Settings.Object)
		items = append(items, list.Items[i])
	}
	list.Items = items
	return list, nil
}

// providerChecker compiles the caller's settings:read grants into an auth.<provider> filter.
func (s *redactingStore) providerChecker(ctx context.Context) (authlib.ItemChecker, error) {
	if s.accessClient == nil {
		return func(_, _ string) bool { return true }, nil
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, _, err := s.accessClient.Compile(ctx, ident, authlib.ListRequest{
		Group:     SettingsAuthzGroup,
		Resource:  SettingsAuthzResource,
		Verb:      utils.VerbList,
		Namespace: ns.Value,
	})
	if err != nil {
		return nil, err
	}
	return checker, nil
}

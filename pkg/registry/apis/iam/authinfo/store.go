package authinfo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

var resourceInfo = iamv0alpha1.AuthInfoResourceInfo

var (
	_ rest.Storage              = (*LegacyStore)(nil)
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Creater              = (*LegacyStore)(nil)
	_ rest.Updater              = (*LegacyStore)(nil)
	_ rest.GracefulDeleter      = (*LegacyStore)(nil)
	_ rest.CollectionDeleter    = (*LegacyStore)(nil)
)

// NewLegacyStore builds a LegacyStore that maps AuthInfo objects onto the
// legacy user_auth table, one row per (user, authModule) pair. Reads and
// writes go through login.Store rather than new SQL.
func NewLegacyStore(identities legacy.LegacyIdentityStore, authInfoStore login.Store, tracer trace.Tracer) *LegacyStore {
	return &LegacyStore{identities, authInfoStore, tracer}
}

type LegacyStore struct {
	identities    legacy.LegacyIdentityStore
	authInfoStore login.Store
	tracer        trace.Tracer
}

// Destroy implements rest.Storage.
func (l *LegacyStore) Destroy() {}

// New implements rest.Storage.
func (l *LegacyStore) New() runtime.Object {
	return resourceInfo.NewFunc()
}

// NewList implements rest.Lister.
func (l *LegacyStore) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

// NamespaceScoped implements rest.Scoper.
func (l *LegacyStore) NamespaceScoped() bool {
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (l *LegacyStore) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

// ConvertToTable implements rest.Lister.
func (l *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// encodeName builds the deterministic object name for a (userUID, authModule) pair.
func encodeName(userUID, authModule string) string {
	return userUID + "." + strings.ReplaceAll(authModule, "_", "-")
}

// decodeName reverses encodeName.
func decodeName(name string) (userUID, authModule string, ok bool) {
	userUID, encodedModule, ok := strings.Cut(name, ".")
	if !ok {
		return "", "", false
	}
	return userUID, strings.ReplaceAll(encodedModule, "-", "_"), true
}

// resolveName maps an object name back to the legacy (userID, authModule) pair it identifies.
func (l *LegacyStore) resolveName(ctx context.Context, ns claims.NamespaceInfo, name string) (userID int64, userUID string, authModule string, err error) {
	userUID, authModule, ok := decodeName(name)
	if !ok {
		return 0, "", "", resourceInfo.NewNotFound(name)
	}

	userRes, err := l.identities.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: userUID})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return 0, "", "", resourceInfo.NewNotFound(name)
		}
		return 0, "", "", err
	}

	return userRes.ID, userUID, authModule, nil
}

// Get implements rest.Getter.
func (l *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ctx, span := l.tracer.Start(ctx, "authinfo.get")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	userID, userUID, authModule, err := l.resolveName(ctx, ns, name)
	if err != nil {
		return nil, err
	}

	authInfo, err := l.authInfoStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userID, AuthModule: authModule})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, resourceInfo.NewNotFound(name)
		}
		return nil, err
	}

	obj := mapToAuthInfoObject(ns, userUID, authInfo)
	return &obj, nil
}

// List implements rest.Lister.
//
// Listing is scoped to one user via the spec.userRef.name field selector.
func (l *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ctx, span := l.tracer.Start(ctx, "authinfo.list")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	var userUID string
	var authModuleFilter string
	var authIDFilter string
	if options.FieldSelector != nil {
		var ok bool
		userUID, ok = options.FieldSelector.RequiresExactMatch("spec.userRef.name")
		if !ok {
			return nil, apierrors.NewBadRequest("listing authinfo requires a spec.userRef.name field selector")
		}
		authModuleFilter, _ = options.FieldSelector.RequiresExactMatch("spec.authModule")
		authIDFilter, _ = options.FieldSelector.RequiresExactMatch("spec.authID")
	} else {
		return nil, apierrors.NewBadRequest("listing authinfo requires a spec.userRef.name field selector")
	}

	userRes, err := l.identities.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: userUID})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return &iamv0alpha1.AuthInfoList{}, nil
		}
		return nil, err
	}

	modules, err := l.authInfoStore.GetUserAuthModules(ctx, userRes.ID)
	if err != nil {
		return nil, err
	}

	list := iamv0alpha1.AuthInfoList{
		Items: make([]iamv0alpha1.AuthInfo, 0, len(modules)),
	}

	for _, m := range modules {
		if authModuleFilter != "" && m != authModuleFilter {
			continue
		}

		authInfo, err := l.authInfoStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userRes.ID, AuthModule: m})
		if err != nil {
			return nil, err
		}

		if authIDFilter != "" && authInfo.AuthId != authIDFilter {
			continue
		}

		list.Items = append(list.Items, mapToAuthInfoObject(ns, userUID, authInfo))
	}

	return &list, nil
}

// Create implements rest.Creater.
func (l *LegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx, span := l.tracer.Start(ctx, "authinfo.create")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	authInfoObj, ok := obj.(*iamv0alpha1.AuthInfo)
	if !ok {
		return nil, fmt.Errorf("expected AuthInfo object, got %T", obj)
	}

	userUID := authInfoObj.Spec.UserRef.Name
	authModule := authInfoObj.Spec.AuthModule

	expectedName := encodeName(userUID, authModule)
	if authInfoObj.Name != "" && authInfoObj.Name != expectedName {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("metadata.name must be %q for spec.userRef.name %q and spec.authModule %q", expectedName, userUID, authModule))
	}
	authInfoObj.Name = expectedName

	if createValidation != nil {
		if err := createValidation(ctx, authInfoObj); err != nil {
			return nil, err
		}
	}

	userRes, err := l.identities.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: userUID})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("user %q not found", userUID))
		}
		return nil, err
	}

	_, err = l.authInfoStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userRes.ID, AuthModule: authModule})
	if err == nil {
		return nil, apierrors.NewAlreadyExists(resourceInfo.GroupResource(), expectedName)
	}
	if !errors.Is(err, user.ErrUserNotFound) {
		return nil, err
	}

	var externalUID string
	if authInfoObj.Spec.ExternalUID != nil {
		externalUID = *authInfoObj.Spec.ExternalUID
	}

	if err := l.authInfoStore.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
		AuthModule:  authModule,
		AuthId:      authInfoObj.Spec.AuthID,
		UserId:      userRes.ID,
		UserUID:     userUID,
		ExternalUID: externalUID,
	}); err != nil {
		return nil, err
	}

	created, err := l.authInfoStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userRes.ID, AuthModule: authModule})
	if err != nil {
		return nil, err
	}

	result := mapToAuthInfoObject(ns, userUID, created)
	return &result, nil
}

// Update implements rest.Updater.
func (l *LegacyStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx, span := l.tracer.Start(ctx, "authinfo.update")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	oldObj, err := l.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return oldObj, false, err
	}

	newAuthInfo, ok := obj.(*iamv0alpha1.AuthInfo)
	if !ok {
		return nil, false, fmt.Errorf("expected AuthInfo object, got %T", obj)
	}

	oldAuthInfo, ok := oldObj.(*iamv0alpha1.AuthInfo)
	if !ok {
		return nil, false, fmt.Errorf("expected AuthInfo object, got %T", oldObj)
	}

	if newAuthInfo.Spec.UserRef.Name != oldAuthInfo.Spec.UserRef.Name || newAuthInfo.Spec.AuthModule != oldAuthInfo.Spec.AuthModule {
		return nil, false, apierrors.NewBadRequest("spec.userRef.name and spec.authModule are immutable")
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, newAuthInfo, oldObj); err != nil {
			return oldObj, false, err
		}
	}

	userRes, err := l.identities.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: newAuthInfo.Spec.UserRef.Name})
	if err != nil {
		return oldObj, false, err
	}

	var externalUID string
	if newAuthInfo.Spec.ExternalUID != nil {
		externalUID = *newAuthInfo.Spec.ExternalUID
	}

	if err := l.authInfoStore.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		AuthModule:  newAuthInfo.Spec.AuthModule,
		AuthId:      newAuthInfo.Spec.AuthID,
		UserId:      userRes.ID,
		ExternalUID: externalUID,
	}); err != nil {
		return oldObj, false, err
	}

	updated, err := l.authInfoStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userRes.ID, AuthModule: newAuthInfo.Spec.AuthModule})
	if err != nil {
		return oldObj, false, err
	}

	result := mapToAuthInfoObject(ns, newAuthInfo.Spec.UserRef.Name, updated)
	return &result, false, nil
}

// Delete implements rest.GracefulDeleter.
func (l *LegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(resourceInfo.GroupResource(), "delete")
}

// DeleteCollection implements rest.CollectionDeleter.
func (l *LegacyStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(resourceInfo.GroupResource(), "deleteCollection")
}

func mapToAuthInfoObject(ns claims.NamespaceInfo, userUID string, ua *login.UserAuth) iamv0alpha1.AuthInfo {
	result := iamv0alpha1.AuthInfo{
		ObjectMeta: metav1.ObjectMeta{
			Name:              encodeName(userUID, ua.AuthModule),
			Namespace:         ns.Value,
			ResourceVersion:   fmt.Sprintf("%d", ua.Created.UnixMilli()),
			CreationTimestamp: metav1.NewTime(ua.Created),
		},
		Spec: iamv0alpha1.AuthInfoSpec{
			UserRef: iamv0alpha1.AuthInfoUserRef{
				Name: userUID,
			},
			AuthModule: ua.AuthModule,
			AuthID:     ua.AuthId,
		},
	}

	if ua.ExternalUID != "" {
		externalUID := ua.ExternalUID
		result.Spec.ExternalUID = &externalUID
	}

	if !ua.Created.IsZero() {
		created := ua.Created.UnixMilli()
		result.Spec.Created = &created
	}

	return result
}

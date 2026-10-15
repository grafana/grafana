package authinfok8s

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	sdkk8s "github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"golang.org/x/oauth2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// Store is a k8s-API-backed implementation of login.Store: it talks to the
// AuthInfo resource (iam.grafana.app) instead of the legacy user_auth table.
type Store struct {
	logger          log.Logger
	namespaceMapper request.NamespaceMapper
	configProvider  apiserver.DirectRestConfigProvider
	tracer          tracing.Tracer
}

var _ login.Store = (*Store)(nil)

func NewStore(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider, tracer tracing.Tracer) *Store {
	return &Store{
		logger:          logger,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
		tracer:          tracer,
	}
}

func (s *Store) clients(ctx context.Context) (authClient *iamv0alpha1.AuthInfoClient, userClient *iamv0alpha1.UserClient, namespace string, err error) {
	if s.configProvider == nil {
		return nil, nil, "", errors.New("authinfok8s: config provider not initialized")
	}
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, nil, "", errors.New("authinfok8s: no request context available")
	}
	cfg := s.configProvider.GetDirectRestConfig(reqCtx)
	if cfg == nil {
		return nil, nil, "", errors.New("authinfok8s: rest config not available")
	}

	orgID, err := s.orgID(ctx)
	if err != nil {
		return nil, nil, "", err
	}
	namespace = s.namespaceMapper(orgID)

	cfg.APIPath = "apis"
	registry := sdkk8s.NewClientRegistry(*cfg, sdkk8s.DefaultClientConfig())

	authClient, err = iamv0alpha1.NewAuthInfoClientFromGenerator(registry)
	if err != nil {
		return nil, nil, "", err
	}
	userClient, err = iamv0alpha1.NewUserClientFromGenerator(registry)
	if err != nil {
		return nil, nil, "", err
	}

	return authClient, userClient, namespace, nil
}

// GetAuthInfo implements login.Store.
func (s *Store) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.GetAuthInfo")
	defer span.End()

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return nil, err
	}

	if query.UserId == 0 {
		if query.AuthId == "" {
			return nil, errors.New("authinfok8s: GetAuthInfo requires UserId or AuthId")
		}

		item, err := s.findByAuthID(ctx, authClient, namespace, query.AuthModule, query.AuthId)
		if err != nil {
			return nil, err
		}

		userID, err := s.legacyUserID(ctx, userClient, namespace, item.Spec.UserRef.Name)
		if err != nil {
			return nil, err
		}

		return toUserAuth(userID, item), nil
	}

	userUID, err := s.userUID(ctx, userClient, namespace, query.UserId)
	if err != nil {
		return nil, err
	}

	var items []iamv0alpha1.AuthInfo
	if query.AuthModule != "" {
		obj, err := authClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: iamv0alpha1.EncodeName(userUID, query.AuthModule)})
		if err != nil {
			if apierrors.IsNotFound(err) {
				return nil, user.ErrUserNotFound
			}
			return nil, err
		}
		items = []iamv0alpha1.AuthInfo{*obj}
	} else {
		items, err = s.listForUser(ctx, authClient, namespace, userUID)
		if err != nil {
			return nil, err
		}
	}

	for _, item := range items {
		if query.AuthId != "" && item.Spec.AuthID != query.AuthId {
			continue
		}
		return toUserAuth(query.UserId, item), nil
	}

	return nil, user.ErrUserNotFound
}

// GetUserAuthModules implements login.Store.
func (s *Store) GetUserAuthModules(ctx context.Context, userID int64) ([]string, error) {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.GetUserAuthModules")
	defer span.End()

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return nil, err
	}

	items, err := s.modulesForUser(ctx, authClient, userClient, namespace, userID)
	if err != nil {
		return nil, err
	}

	modules := make([]string, 0, len(items))
	for _, item := range items {
		modules = append(modules, item.Spec.AuthModule)
	}

	return modules, nil
}

// GetUsersRecentlyUsedLabel implements login.Store.
func (s *Store) GetUsersRecentlyUsedLabel(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.GetUsersRecentlyUsedLabel")
	defer span.End()

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[int64]string, len(query.UserIDs))
	for _, userID := range query.UserIDs {
		items, err := s.modulesForUser(ctx, authClient, userClient, namespace, userID)
		if err != nil {
			return nil, err
		}
		if len(items) > 0 {
			result[userID] = items[0].Spec.AuthModule
		}
	}

	return result, nil
}

// SetAuthInfo implements login.Store.
func (s *Store) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.SetAuthInfo")
	defer span.End()

	if hasTokenValue(cmd.OAuthToken) {
		return errors.New("authinfok8s: SetAuthInfo cannot store an OAuth token; use the legacy store")
	}

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return err
	}

	userUID := cmd.UserUID
	if userUID == "" {
		userUID, err = s.userUID(ctx, userClient, namespace, cmd.UserId)
		if err != nil {
			return err
		}
	}

	now := time.Now().UnixMilli()
	obj := &iamv0alpha1.AuthInfo{
		ObjectMeta: metav1.ObjectMeta{Name: iamv0alpha1.EncodeName(userUID, cmd.AuthModule), Namespace: namespace},
		Spec: iamv0alpha1.AuthInfoSpec{
			UserRef:    iamv0alpha1.AuthInfoUserRef{Name: userUID},
			AuthModule: cmd.AuthModule,
			AuthID:     cmd.AuthId,
			Created:    &now,
		},
	}
	if cmd.ExternalUID != "" {
		obj.Spec.ExternalUID = &cmd.ExternalUID
	}

	if _, err := authClient.Create(ctx, obj, resource.CreateOptions{}); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return s.applyUpdate(ctx, authClient, namespace, obj.Name, cmd.AuthId, cmd.ExternalUID)
		}
		return err
	}
	return nil
}

// UpdateAuthInfo implements login.Store.
func (s *Store) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.UpdateAuthInfo")
	defer span.End()

	if hasTokenValue(cmd.OAuthToken) {
		return errors.New("authinfok8s: UpdateAuthInfo cannot store an OAuth token; use the legacy store")
	}

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return err
	}

	userUID, err := s.userUID(ctx, userClient, namespace, cmd.UserId)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil
		}
		return err
	}

	return s.applyUpdate(ctx, authClient, namespace, iamv0alpha1.EncodeName(userUID, cmd.AuthModule), cmd.AuthId, cmd.ExternalUID)
}

// DeleteUserAuthInfo implements login.Store.
func (s *Store) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.DeleteUserAuthInfo")
	defer span.End()

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return err
	}

	userUID, err := s.userUID(ctx, userClient, namespace, userID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil
		}
		return err
	}

	items, err := s.listForUser(ctx, authClient, namespace, userUID)
	if err != nil {
		return err
	}

	for _, item := range items {
		if err := authClient.Delete(ctx, resource.Identifier{Namespace: namespace, Name: item.Name}, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return err
		}
	}
	return nil
}

// DeleteAuthInfo implements login.Store.
func (s *Store) DeleteAuthInfo(ctx context.Context, cmd *login.DeleteAuthInfoCommand) error {
	ctx, span := s.tracer.Start(ctx, "authinfo.k8s.DeleteAuthInfo")
	defer span.End()

	authClient, userClient, namespace, err := s.clients(ctx)
	if err != nil {
		return err
	}

	userUID, err := s.userUID(ctx, userClient, namespace, cmd.UserAuth.UserId)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil
		}
		return err
	}

	name := iamv0alpha1.EncodeName(userUID, cmd.UserAuth.AuthModule)
	if err := authClient.Delete(ctx, resource.Identifier{Namespace: namespace, Name: name}, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

// hasTokenValue reports whether t actually carries token data worth
// persisting, as opposed to an empty token used only to clear one.
func hasTokenValue(t *oauth2.Token) bool {
	return t != nil && (t.AccessToken != "" || t.RefreshToken != "" || t.TokenType != "" || !t.Expiry.IsZero() || t.Extra("id_token") != nil)
}

// applyUpdate fetches the named object and updates its mutable fields.
// A NotFound here is a silent no-op (see UpdateAuthInfo), not an error.
func (s *Store) applyUpdate(ctx context.Context, client *iamv0alpha1.AuthInfoClient, namespace, name, authID, externalUID string) error {
	existing, err := client.Get(ctx, resource.Identifier{Namespace: namespace, Name: name})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	}

	existing.Spec.AuthID = authID
	// Only overwrite ExternalUID when the caller actually supplied one.
	if externalUID != "" {
		existing.Spec.ExternalUID = &externalUID
	}

	// Bump Created on every update, matching the legacy store.
	now := time.Now().UnixMilli()
	existing.Spec.Created = &now

	_, err = client.Update(ctx, existing, resource.UpdateOptions{})
	if err != nil && apierrors.IsNotFound(err) {
		return nil
	}

	return err
}

func (s *Store) orgID(ctx context.Context) (int64, error) {
	requester, err := identity.GetRequester(ctx)
	if err == nil && requester != nil {
		return requester.GetOrgID(), nil
	}
	if orgID, ok := identity.OrgIDFrom(ctx); ok {
		return orgID, nil
	}

	return 0, errors.New("authinfok8s: no org ID available in context")
}

// legacyUserID resolves a User resource's UID back to its legacy internal user ID.
func (s *Store) legacyUserID(ctx context.Context, client *iamv0alpha1.UserClient, namespace, userUID string) (int64, error) {
	u, err := client.Get(ctx, resource.Identifier{Namespace: namespace, Name: userUID})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return 0, user.ErrUserNotFound
		}
		return 0, err
	}

	meta, err := utils.MetaAccessor(u)
	if err != nil {
		return 0, err
	}

	return meta.GetDeprecatedInternalID(), nil // nolint:staticcheck
}

// findByAuthID looks up the most-recently-created AuthInfo object matching
// authModule + authID, across all users.
func (s *Store) findByAuthID(ctx context.Context, client *iamv0alpha1.AuthInfoClient, namespace, authModule, authID string) (iamv0alpha1.AuthInfo, error) {
	selectors := []string{"spec.authID=" + fields.EscapeValue(authID)}
	if authModule != "" {
		selectors = append(selectors, "spec.authModule="+fields.EscapeValue(authModule))
	}

	list, err := client.ListAll(ctx, namespace, resource.ListOptions{FieldSelectors: selectors})
	if err != nil {
		return iamv0alpha1.AuthInfo{}, err
	}
	if len(list.Items) == 0 {
		return iamv0alpha1.AuthInfo{}, user.ErrUserNotFound
	}

	items := list.Items
	sort.SliceStable(items, func(i, j int) bool {
		return created(items[i]).After(created(items[j]))
	})

	return items[0], nil
}

// userUID resolves a legacy internal user ID to the User resource's UID
func (s *Store) userUID(ctx context.Context, client *iamv0alpha1.UserClient, namespace string, userID int64) (string, error) {
	list, err := client.List(ctx, namespace, resource.ListOptions{
		LabelFilters: []string{utils.LabelKeyDeprecatedInternalID + "=" + strconv.FormatInt(userID, 10)},
	})
	if err != nil {
		return "", err
	}

	switch len(list.Items) {
	case 0:
		return "", user.ErrUserNotFound
	case 1:
		return list.Items[0].Name, nil
	default:
		return "", fmt.Errorf("authinfok8s: %d users found with internal ID %d", len(list.Items), userID)
	}
}

// listForUser returns every AuthInfo object for a user, most-recently-created first.
func (s *Store) listForUser(ctx context.Context, client *iamv0alpha1.AuthInfoClient, namespace, userUID string) ([]iamv0alpha1.AuthInfo, error) {
	list, err := client.ListAll(ctx, namespace, resource.ListOptions{
		FieldSelectors: []string{"spec.userRef.name=" + userUID},
	})
	if err != nil {
		return nil, err
	}

	items := list.Items
	sort.SliceStable(items, func(i, j int) bool {
		return created(items[i]).After(created(items[j]))
	})

	return items, nil
}

// modulesForUser resolves userID to a userUID and lists its AuthInfo objects.
func (s *Store) modulesForUser(ctx context.Context, authClient *iamv0alpha1.AuthInfoClient, userClient *iamv0alpha1.UserClient, namespace string, userID int64) ([]iamv0alpha1.AuthInfo, error) {
	userUID, err := s.userUID(ctx, userClient, namespace, userID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return s.listForUser(ctx, authClient, namespace, userUID)
}

func created(obj iamv0alpha1.AuthInfo) time.Time {
	if obj.Spec.Created != nil {
		return time.UnixMilli(*obj.Spec.Created).UTC()
	}
	return obj.CreationTimestamp.Time
}

// toUserAuth converts a k8s AuthInfo object into the legacy login.UserAuth
func toUserAuth(userID int64, obj iamv0alpha1.AuthInfo) *login.UserAuth {
	var externalUID string
	if obj.Spec.ExternalUID != nil {
		externalUID = *obj.Spec.ExternalUID
	}

	var id int64
	if meta, err := utils.MetaAccessor(&obj); err == nil {
		id = meta.GetDeprecatedInternalID() // nolint:staticcheck
	}

	return &login.UserAuth{
		Id:          id,
		UserId:      userID,
		UserUID:     obj.Spec.UserRef.Name,
		AuthModule:  obj.Spec.AuthModule,
		AuthId:      obj.Spec.AuthID,
		Created:     created(obj),
		ExternalUID: externalUID,
	}
}

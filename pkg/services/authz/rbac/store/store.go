package store

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	claims "github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var ofClient = openfeature.NewDefaultClient()

type Store interface {
	GetUserIdentifiers(ctx context.Context, ns claims.NamespaceInfo, query UserIdentifierQuery) (*UserIdentifiers, error)
	GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query BasicRoleQuery) (*BasicRole, error)
}

type StoreImpl struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
	// restConfigProvider, when set, enables resolving users from unified storage.
	restConfigProvider func(ctx context.Context) (*rest.Config, error)
}

// NewStore creates the authz store. restConfigProvider may be nil.
func NewStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer, restConfigProvider func(ctx context.Context) (*rest.Config, error)) *StoreImpl {
	return &StoreImpl{
		sql:                sql,
		tracer:             tracer,
		restConfigProvider: restConfigProvider,
	}
}

// isKubernetesRedirectEnabled reports whether users should be resolved from
// unified storage instead of the legacy database.
func (s *StoreImpl) isKubernetesRedirectEnabled(ctx context.Context) bool {
	return s.restConfigProvider != nil &&
		ofClient.Boolean(ctx, featuremgmt.FlagKubernetesUsersRedirect, false, openfeature.TransactionContext(ctx))
}

type userIdentity struct {
	id      int64
	uid     string
	role    string
	isAdmin bool
}

// resolveUserIdentity fetches a user by UID from the IAM apiserver.
func (s *StoreImpl) resolveUserIdentity(ctx context.Context, ns claims.NamespaceInfo, userUID string) (*userIdentity, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.resolveUserIdentity")
	defer span.End()

	cfg, err := s.restConfigProvider(ctx)
	if err != nil {
		return nil, err
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	obj, err := client.Resource(iamv0.UserResourceInfo.GroupVersionResource()).Namespace(ns.Value).Get(ctx, userUID, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("resolve user %q from unified storage: %w", userUID, err)
	}

	var u iamv0.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &u); err != nil {
		return nil, fmt.Errorf("decode user %q: %w", userUID, err)
	}

	var internalID int64
	if meta, err := utils.MetaAccessor(obj); err == nil {
		internalID = meta.GetDeprecatedInternalID() // nolint:staticcheck
	}

	role := u.Spec.Role
	if role == "" {
		role = "None"
	}

	return &userIdentity{id: internalID, uid: userUID, role: role, isAdmin: u.Spec.GrafanaAdmin}, nil
}

func (s *StoreImpl) GetUserIdentifiers(ctx context.Context, ns claims.NamespaceInfo, query UserIdentifierQuery) (*UserIdentifiers, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetUserIdentifiers")
	defer span.End()

	// Resolve from unified storage when the kubernetesUsersRedirect toggle is on.
	if s.isKubernetesRedirectEnabled(ctx) && query.UserUID != "" {
		identity, err := s.resolveUserIdentity(ctx, ns, query.UserUID)
		if err != nil {
			return nil, fmt.Errorf("user could not be found: %w", err)
		}
		return &UserIdentifiers{ID: identity.id, UID: identity.uid}, nil
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetUserIdentifiers(sql, &query)
	q, err := sqltemplate.Execute(sqlUserIdentifiers, req)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, fmt.Errorf("user could not be found")
	}

	var userIDs UserIdentifiers
	if err := rows.Scan(&userIDs.ID, &userIDs.UID); err != nil {
		return nil, err
	}

	return &userIDs, nil
}

func (s *StoreImpl) GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query BasicRoleQuery) (*BasicRole, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetBasicRoles")
	defer span.End()

	// Resolve from unified storage when the kubernetesUsersRedirect toggle is on.
	if s.isKubernetesRedirectEnabled(ctx) && query.UserUID != "" {
		identity, err := s.resolveUserIdentity(ctx, ns, query.UserUID)
		if err != nil {
			return nil, fmt.Errorf("no basic roles found for the user: %w", err)
		}
		return &BasicRole{Role: identity.role, IsAdmin: identity.isAdmin}, nil
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	query.OrgID = ns.OrgID
	req := newGetBasicRoles(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryBasicRoles, req)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, fmt.Errorf("no basic roles found for the user")
	}

	var role BasicRole
	if err := rows.Scan(&role.Role, &role.IsAdmin); err != nil {
		return nil, err
	}

	return &role, nil
}

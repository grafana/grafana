package coordination

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/watch"

	claims "github.com/grafana/authlib/types"
	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

func svc(uid string) *identity.StaticRequester {
	return &identity.StaticRequester{Type: claims.TypeAccessPolicy, UserUID: uid}
}

func admin() *identity.StaticRequester {
	return &identity.StaticRequester{Type: claims.TypeUser, UserUID: "1", IsGrafanaAdmin: true}
}

func tenantUser() *identity.StaticRequester {
	return &identity.StaticRequester{Type: claims.TypeUser, UserUID: "2"}
}

func ctxFor(r identity.Requester) context.Context {
	return identity.WithRequester(context.Background(), r)
}

func globalLease(name, owner string) *coordinationv0alpha1.GlobalLease {
	l := &coordinationv0alpha1.GlobalLease{}
	l.Name = name
	if owner != "" {
		l.Annotations = map[string]string{annotationOwner: owner}
	}
	return l
}

func TestGlobalLeaseAuthorizer_ServiceGate(t *testing.T) {
	a := &leaseStorageAuthorizer{}

	// A regular tenant user is not a service identity: denied outright.
	err := a.BeforeCreate(ctxFor(tenantUser()), globalLease("x", ""))
	require.ErrorIs(t, err, storewrapper.ErrUnauthorized)

	// No identity in context: denied.
	err = a.AfterGet(context.Background(), globalLease("x", "access-policy:a"))
	require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
}

func TestGlobalLeaseAuthorizer_CreateStampsOwner(t *testing.T) {
	a := &leaseStorageAuthorizer{}
	obj := globalLease("x", "")

	require.NoError(t, a.BeforeCreate(ctxFor(svc("a")), obj))

	require.Equal(t, "access-policy:a", obj.Annotations[annotationOwner])
	require.Equal(t, "access-policy-a", obj.Labels[labelOwner], "colon sanitized for label selection")
}

func TestGlobalLeaseAuthorizer_OwnerScopedMutation(t *testing.T) {
	a := &leaseStorageAuthorizer{}
	owned := globalLease("x", "access-policy:a")

	// Owner may renew/delete/get its own lease.
	require.NoError(t, a.BeforeUpdate(ctxFor(svc("a")), owned, globalLease("x", "access-policy:a")))
	require.NoError(t, a.BeforeDelete(ctxFor(svc("a")), owned))
	require.NoError(t, a.AfterGet(ctxFor(svc("a")), owned))

	// A different service cannot touch it.
	require.ErrorIs(t, a.BeforeUpdate(ctxFor(svc("b")), owned, globalLease("x", "access-policy:a")), storewrapper.ErrUnauthorized)
	require.ErrorIs(t, a.BeforeDelete(ctxFor(svc("b")), owned), storewrapper.ErrUnauthorized)
	require.ErrorIs(t, a.AfterGet(ctxFor(svc("b")), owned), storewrapper.ErrUnauthorized)

	// Admin bypasses owner scoping.
	require.NoError(t, a.BeforeDelete(ctxFor(admin()), owned))
	require.NoError(t, a.AfterGet(ctxFor(admin()), owned))
}

func TestGlobalLeaseAuthorizer_UpdateCannotReassignOwner(t *testing.T) {
	a := &leaseStorageAuthorizer{}
	owned := globalLease("x", "access-policy:a")
	// Caller a tries to hand the lease to b via the update payload.
	incoming := globalLease("x", "access-policy:b")

	require.NoError(t, a.BeforeUpdate(ctxFor(svc("a")), owned, incoming))
	require.Equal(t, "access-policy:a", incoming.Annotations[annotationOwner], "owner is preserved from the stored object")
}

func TestGlobalLeaseAuthorizer_FilterListScopesToOwner(t *testing.T) {
	a := &leaseStorageAuthorizer{}
	list := &coordinationv0alpha1.GlobalLeaseList{Items: []coordinationv0alpha1.GlobalLease{
		*globalLease("a1", "access-policy:a"),
		*globalLease("b1", "access-policy:b"),
		*globalLease("a2", "access-policy:a"),
	}}

	out, err := a.FilterList(ctxFor(svc("a")), list.Copy())
	require.NoError(t, err)
	filtered := out.(*coordinationv0alpha1.GlobalLeaseList)
	require.Len(t, filtered.Items, 2)
	for _, item := range filtered.Items {
		require.Equal(t, "access-policy:a", item.Annotations[annotationOwner])
	}

	// Admin sees everything.
	out, err = a.FilterList(ctxFor(admin()), list.Copy())
	require.NoError(t, err)
	require.Len(t, out.(*coordinationv0alpha1.GlobalLeaseList).Items, 3)
}

func TestGlobalLeaseAuthorizer_WatchFilterScopesToOwner(t *testing.T) {
	a := &leaseStorageAuthorizer{}
	filter, err := a.WatchFilter(ctxFor(svc("a")))
	require.NoError(t, err)

	keep, err := filter([]watch.Event{
		{Type: watch.Added, Object: globalLease("a1", "access-policy:a")},
		{Type: watch.Added, Object: globalLease("b1", "access-policy:b")},
	})
	require.NoError(t, err)
	require.Equal(t, []bool{true, false}, keep)
}

func TestGlobalLeaseAuthorizer_RBACGrantedUserSeesAll(t *testing.T) {
	// A non-admin, non-service user granted the RBAC action is allowed and is NOT
	// owner-scoped (it never owns leases, so scoping would hide everything).
	a := &leaseStorageAuthorizer{accessControl: actest.FakeAccessControl{ExpectedEvaluate: true}}
	ctx := ctxFor(tenantUser())

	require.NoError(t, a.AfterGet(ctx, globalLease("owned-by-a", "access-policy:a")))

	list := &coordinationv0alpha1.GlobalLeaseList{Items: []coordinationv0alpha1.GlobalLease{
		*globalLease("a1", "access-policy:a"),
		*globalLease("b1", "access-policy:b"),
	}}
	out, err := a.FilterList(ctx, list.Copy())
	require.NoError(t, err)
	require.Len(t, out.(*coordinationv0alpha1.GlobalLeaseList).Items, 2, "granted user sees the whole keyspace")

	filter, err := a.WatchFilter(ctx)
	require.NoError(t, err)
	require.NotNil(t, filter)
}

func TestGlobalLeaseAuthorizer_RBACDeniedUser(t *testing.T) {
	// A non-admin, non-service user without the RBAC action is denied everywhere.
	a := &leaseStorageAuthorizer{accessControl: actest.FakeAccessControl{ExpectedEvaluate: false}}
	ctx := ctxFor(tenantUser())

	require.ErrorIs(t, a.BeforeCreate(ctx, globalLease("x", "")), storewrapper.ErrUnauthorized)
	require.ErrorIs(t, a.AfterGet(ctx, globalLease("x", "access-policy:a")), storewrapper.ErrUnauthorized)
	_, err := a.FilterList(ctx, (&coordinationv0alpha1.GlobalLeaseList{}).Copy())
	require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
	_, err = a.WatchFilter(ctx)
	require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
}

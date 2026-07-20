package team

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		obj       *iamv0alpha1.Team
		want      error
	}{
		{
			name: "valid team - not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "test",
					Email: "test@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid team - provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			want: nil,
		},
		{
			name: "invalid team - no title",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "",
					Email: "test@test.com",
				},
			},
			want: apierrors.NewBadRequest("the team must have a title"),
		},
		{
			name: "invalid team - it's provisioned but the requester is not a service account",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams are only allowed for service accounts"),
		},
		{
			name: "invalid team - has externalUID but it's not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					ExternalUID: "test-uid",
				},
			},
			want: apierrors.NewBadRequest("externalUID is only allowed for provisioned teams"),
		},
		{
			name:      "invalid team - no requester in context",
			requester: nil,
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "test",
					Email: "test@test.com",
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), test.requester)
			err := ValidateOnCreate(ctx, &fakeTeamSearchClient{}, test.obj, legacy.NoopExternalGroupReconciler{})
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateOnUpdate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		obj       *iamv0alpha1.Team
		old       *iamv0alpha1.Team
		want      error
	}{
		{
			name: "valid update - no changes to provisioned status",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid update - service account changing to provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid update - already provisioned team",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "updated-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
					ExternalUID: "original-uid",
				},
			},
			want: nil,
		},
		{
			name: "invalid update - no title",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("the team must have a title"),
		},
		{
			name: "invalid update - user trying to change to provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams are only allowed for service accounts"),
		},
		{
			name: "invalid update - changing from provisioned to non-provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
					ExternalUID: "original-uid",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams cannot be updated to non-provisioned teams"),
		},
		{
			name: "invalid update - has externalUID but not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("externalUID is only allowed for provisioned teams"),
		},
		{
			name:      "invalid update - no requester in context",
			requester: nil,
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
		},
		{
			name: "valid update - adding externalUID to provisioned team",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "new-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
				},
			},
			want: nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), test.requester)
			err := ValidateOnUpdate(ctx, &fakeTeamSearchClient{}, test.obj, test.old, legacy.NoopExternalGroupReconciler{})
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateExternalGroups(t *testing.T) {
	t.Run("nil and empty pass through to reconciler.Validate", func(t *testing.T) {
		stub := &stubReconciler{}
		require.NoError(t, validateExternalGroups(nil, stub))
		assert.Nil(t, stub.gotInput)

		stub = &stubReconciler{}
		require.NoError(t, validateExternalGroups([]string{}, stub))
		assert.Empty(t, stub.gotInput)
	})

	t.Run("rejects empty entry", func(t *testing.T) {
		err := validateExternalGroups([]string{"foo", ""}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
		assert.Contains(t, statusErr.ErrStatus.Message, "non-empty")
	})

	t.Run("rejects whitespace-only entry", func(t *testing.T) {
		err := validateExternalGroups([]string{"   "}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
	})

	t.Run("rejects duplicates after normalization", func(t *testing.T) {
		err := validateExternalGroups([]string{"LDAP-Admins", "ldap-admins"}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
		assert.Contains(t, statusErr.ErrStatus.Message, "duplicate")
	})

	t.Run("delegates implementation-specific checks to the reconciler", func(t *testing.T) {
		boom := errors.New("over length")
		stub := &stubReconciler{err: boom}
		err := validateExternalGroups([]string{"LDAP-Admins"}, stub)
		require.ErrorIs(t, err, boom)
		assert.Equal(t, []string{"LDAP-Admins"}, stub.gotInput,
			"validateExternalGroups must pass groups through to reconciler.Validate without mutating")
	})
}

type stubReconciler struct {
	legacy.NoopExternalGroupReconciler
	err      error
	gotInput []string
}

func (s *stubReconciler) Validate(groups []string) error {
	s.gotInput = groups
	return s.err
}

// fakeTeamSearchClient controls what the title lookup "finds". By default it
// returns a fixed set of rows (or an error) with TotalHits derived from them,
// regardless of the query, and records the last request. searchFunc, when set,
// overrides the response so a test can decouple TotalHits from the rows (e.g. a
// count-only response) — mirroring FakeUserLegacySearchClient's SearchFunc hook.
type fakeTeamSearchClient struct {
	resourcepb.ResourceIndexClient
	rows          []*resourcepb.ResourceTableRow
	err           error
	searchFunc    func(*resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
	lastReq       *resourcepb.ResourceSearchRequest
	lastRequester identity.Requester
}

func (c *fakeTeamSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	c.lastReq = req
	c.lastRequester, _ = identity.GetRequester(ctx)
	if c.searchFunc != nil {
		return c.searchFunc(req)
	}
	if c.err != nil {
		return nil, c.err
	}
	return &resourcepb.ResourceSearchResponse{
		Results:   &resourcepb.ResourceTable{Rows: c.rows},
		TotalHits: int64(len(c.rows)),
	}, nil
}

func teamRow(name string) *resourcepb.ResourceTableRow {
	return &resourcepb.ResourceTableRow{Key: &resourcepb.ResourceKey{Name: name}}
}

func TestValidateOnCreate_TitleUniqueness(t *testing.T) {
	requester := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-1"}
	newTeam := &iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{Name: "new-uid"},
		Spec:       iamv0alpha1.TeamSpec{Title: "Engineering"},
	}

	t.Run("no existing team with the title passes", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		err := ValidateOnCreate(ctx, &fakeTeamSearchClient{}, newTeam, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})

	t.Run("existing team with the title is rejected as conflict", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		client := &fakeTeamSearchClient{rows: []*resourcepb.ResourceTableRow{teamRow("other-uid")}}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err), "expected a Conflict error, got %v", err)
	})

	t.Run("only self-match is not a conflict", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		// Dual-write can index the same team from both stores under its own name.
		client := &fakeTeamSearchClient{rows: []*resourcepb.ResourceTableRow{teamRow("new-uid")}}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})

	t.Run("self plus another team is a conflict", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		client := &fakeTeamSearchClient{rows: []*resourcepb.ResourceTableRow{teamRow("new-uid"), teamRow("other-uid")}}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err), "expected a Conflict error, got %v", err)
	})

	t.Run("search error is propagated", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		client := &fakeTeamSearchClient{err: errors.New("index down")}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.ErrorContains(t, err, "index down")
	})

	t.Run("lookup requests a bounded page targeting the title field", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		client := &fakeTeamSearchClient{}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)

		require.NotNil(t, client.lastReq)
		// Pinned to 2: the fake returns all rows regardless of limit, so a
		// shrunken page (breaking the self-match exclusion against a real
		// backend) would otherwise go unnoticed here.
		assert.Equal(t, int64(2), client.lastReq.Limit)
		assert.Equal(t, int64(1), client.lastReq.Page)
		require.NotNil(t, client.lastReq.Options)
		require.NotNil(t, client.lastReq.Options.Key)
		gr := iamv0alpha1.TeamResourceInfo.GroupResource()
		assert.Equal(t, gr.Group, client.lastReq.Options.Key.Group)
		assert.Equal(t, gr.Resource, client.lastReq.Options.Key.Resource)
		assert.Equal(t, "stacks-1", client.lastReq.Options.Key.Namespace)
		require.Len(t, client.lastReq.Options.Fields, 1)
		assert.Equal(t, resource.SEARCH_FIELD_TITLE, client.lastReq.Options.Fields[0].Key)
		assert.Equal(t, string(selection.DoubleEquals), client.lastReq.Options.Fields[0].Operator)
		assert.Equal(t, []string{resource.SEARCH_FIELD_TITLE}, client.lastReq.Fields)
	})

	t.Run("unparseable requester namespace is an internal error", func(t *testing.T) {
		badNs := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-abc"}
		ctx := identity.WithRequester(context.Background(), badNs)
		client := &fakeTeamSearchClient{}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		assert.True(t, apierrors.IsInternalError(err), "expected an InternalError, got %v", err)
		assert.Nil(t, client.lastReq, "the lookup must not run without a resolved org")
	})

	t.Run("lookup runs under the service identity, not the requester", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		client := &fakeTeamSearchClient{}
		err := ValidateOnCreate(ctx, client, newTeam, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)

		// Team read access is often scoped to membership; a requester-scoped
		// search would miss colliding teams the requester cannot read.
		require.NotNil(t, client.lastRequester)
		assert.True(t, client.lastRequester.IsIdentityType(types.TypeAccessPolicy),
			"expected the service identity, got %s", client.lastRequester.GetIdentityType())
	})
}

func TestValidateOnUpdate_TitleUniqueness(t *testing.T) {
	requester := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-1"}

	t.Run("renaming to a title taken by another team is rejected", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Old"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Taken"}}
		client := &fakeTeamSearchClient{rows: []*resourcepb.ResourceTableRow{teamRow("uid-2")}}
		err := ValidateOnUpdate(ctx, client, obj, old, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err), "expected a Conflict error, got %v", err)
	})

	t.Run("unchanged title does not trigger the uniqueness lookup", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Same"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Same"}}
		// Even if the index would report a collision, an unchanged title must not fail.
		client := &fakeTeamSearchClient{err: errors.New("must not be called")}
		err := ValidateOnUpdate(ctx, client, obj, old, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})

	t.Run("renaming to a free title passes", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Old"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Free"}}
		client := &fakeTeamSearchClient{} // title changed, lookup runs, finds nothing
		err := ValidateOnUpdate(ctx, client, obj, old, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})

	t.Run("case-only rename matching only itself is not a conflict", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "MyTeam"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "myteam"}}
		// The title changed (so the lookup runs), but the case-insensitive match
		// hits only the team's own indexed doc — that must not be a conflict.
		client := &fakeTeamSearchClient{rows: []*resourcepb.ResourceTableRow{teamRow("uid-1")}}
		err := ValidateOnUpdate(ctx, client, obj, old, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})

	t.Run("hits reported without attributable rows is not a conflict", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Old"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "New"}}
		// The conflict decision keys off returned rows, not TotalHits: a response
		// with hits but no rows yields nothing to attribute to another team.
		client := &fakeTeamSearchClient{searchFunc: func(*resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{TotalHits: 1, Results: &resourcepb.ResourceTable{}}, nil
		}}
		err := ValidateOnUpdate(ctx, client, obj, old, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})
}

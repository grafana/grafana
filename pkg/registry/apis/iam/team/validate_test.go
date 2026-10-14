package team

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	"github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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
			err := ValidateOnCreate(ctx, selectorForBackend(&fakeSearchBackend{}), test.obj, legacy.NoopExternalGroupReconciler{})
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
			err := ValidateOnUpdate(ctx, selectorForBackend(&fakeSearchBackend{}), test.obj, test.old, legacy.NoopExternalGroupReconciler{})
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateOnDelete(t *testing.T) {
	team := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "team-a", Namespace: "org-1"}}

	t.Run("allows deleting a team that does not own folders", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{response: &resourcepb.ResourceSearchResponse{}}

		require.NoError(t, ValidateOnDelete(t.Context(), searcher, team))
		require.NotNil(t, searcher.request)
		assert.Equal(t, int64(1), searcher.request.Limit)
		assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, searcher.request.ResultFormat)
		assert.Equal(t, []string{resource.SEARCH_FIELD_NAME}, searcher.request.Fields)
		assert.Equal(t, &resourcepb.ResourceKey{
			Namespace: team.Namespace,
			Group:     foldersv1.FolderResourceInfo.GroupResource().Group,
			Resource:  foldersv1.FolderResourceInfo.GroupResource().Resource,
		}, searcher.request.Options.Key)
		require.Len(t, searcher.request.Options.Fields, 1)
		assert.Equal(t, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_OWNER_REFERENCES,
			Operator: "=",
			Values:   []string{"iam.grafana.app/Team/team-a"},
		}, searcher.request.Options.Fields[0])

		requester, err := identity.GetRequester(searcher.ctx)
		require.NoError(t, err)
		assert.True(t, requester.IsIdentityType(types.TypeAccessPolicy))
		assert.Equal(t, team.Namespace, requester.GetNamespace())
	})

	t.Run("blocks deleting a team that owns a folder", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{response: &resourcepb.ResourceSearchResponse{TotalHits: 1}}

		err := ValidateOnDelete(t.Context(), searcher, team)

		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err))
		assert.ErrorContains(t, err, "remove folder ownership before deleting the team")
	})

	t.Run("blocks when the search backend returns a table row without total hits", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{response: &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{}}},
		}}

		err := ValidateOnDelete(t.Context(), searcher, team)

		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err))
	})

	t.Run("blocks when the search backend returns a field-value row without total hits", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{response: &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Rows:         []*resourcepb.ResourceSearchRow{{Key: &resourcepb.ResourceKey{Name: "folder-1"}}},
		}}

		err := ValidateOnDelete(t.Context(), searcher, team)

		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err))
	})

	t.Run("returns search errors", func(t *testing.T) {
		searchErr := errors.New("search unavailable")
		searcher := &deleteValidationSearchClient{err: searchErr}

		assert.ErrorIs(t, ValidateOnDelete(t.Context(), searcher, team), searchErr)
	})

	t.Run("returns errors embedded in the search response", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{response: &resourcepb.ResourceSearchResponse{
			Error: &resourcepb.ErrorResult{Message: "search unavailable", Code: http.StatusServiceUnavailable},
		}}

		err := ValidateOnDelete(t.Context(), searcher, team)

		require.Error(t, err)
		assert.ErrorContains(t, err, "search unavailable")
	})

	t.Run("does not expose unstructured search failures", func(t *testing.T) {
		searcher := &deleteValidationSearchClient{err: status.Error(codes.Internal, "private database failure")}

		err := ValidateOnDelete(t.Context(), searcher, team)

		apiStatus := responsewriters.ErrorToAPIStatus(err)
		require.Equal(t, int32(http.StatusInternalServerError), apiStatus.Code)
		require.Equal(t, http.StatusText(http.StatusInternalServerError), apiStatus.Message)
	})

	t.Run("allows deletion when folder search is not configured", func(t *testing.T) {
		require.NoError(t, ValidateOnDelete(t.Context(), nil, team))
	})
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

type deleteValidationSearchClient struct {
	resourcepb.ResourceIndexClient
	ctx      context.Context
	request  *resourcepb.ResourceSearchRequest
	response *resourcepb.ResourceSearchResponse
	err      error
}

func (s *deleteValidationSearchClient) Search(ctx context.Context, request *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.ctx = ctx
	s.request = request
	return s.response, s.err
}

func (s *stubReconciler) Validate(groups []string) error {
	s.gotInput = groups
	return s.err
}

func TestValidateTitleUniqueSearchErrors(t *testing.T) {
	plainErr := errors.New("index down")
	for name, client := range map[string]*deleteValidationSearchClient{
		"embedded": {response: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{
			Code: http.StatusServiceUnavailable, Message: "index unavailable",
		}}},
		"transport": {err: status.Error(codes.Unavailable, "index unavailable")},
		"plain":     {err: plainErr},
	} {
		t.Run(name, func(t *testing.T) {
			err := validateTitleUnique(t.Context(), selectorForBackend(NewUnifiedSearchClient(client)), "stacks-1", "new-team", "Engineering")
			if name == "plain" {
				require.ErrorIs(t, err, plainErr)
			} else {
				require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
			}
		})
	}
}

func TestValidateOnCreate_TitleUniqueness(t *testing.T) {
	requester := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-1"}
	newTeam := &iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{Name: "new-uid"},
		Spec:       iamv0alpha1.TeamSpec{Title: "Engineering"},
	}

	for _, tt := range []struct {
		name     string
		hits     []iamv0alpha1.GetSearchTeamsTeamHit
		conflict bool
	}{
		{name: "no existing team"},
		{name: "another team", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "other-uid"}}, conflict: true},
		{name: "only self", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "new-uid"}}},
		{name: "self and another team", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "new-uid"}, {Name: "other-uid"}}, conflict: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), requester)
			backend := &fakeSearchBackend{hits: tt.hits}
			err := ValidateOnCreate(ctx, selectorForBackend(backend), newTeam, legacy.NoopExternalGroupReconciler{})
			if tt.conflict {
				require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
			} else {
				require.NoError(t, err)
			}
			// Two results allow validation to exclude a self-match without missing a duplicate.
			require.Equal(t, &SearchQuery{Namespace: "stacks-1", Title: "Engineering", Limit: 2, Page: 1}, backend.lastQuery)
			require.NotNil(t, backend.lastRequester)
			require.True(t, backend.lastRequester.IsIdentityType(types.TypeAccessPolicy))
			require.Equal(t, int64(1), backend.lastRequester.GetOrgID())
		})
	}

	t.Run("search error is propagated", func(t *testing.T) {
		ctx := identity.WithRequester(t.Context(), requester)
		wantErr := errors.New("index down")
		backend := &fakeSearchBackend{err: wantErr}
		err := ValidateOnCreate(ctx, selectorForBackend(backend), newTeam, legacy.NoopExternalGroupReconciler{})
		require.ErrorIs(t, err, wantErr)
	})

	t.Run("unparseable requester namespace is an internal error", func(t *testing.T) {
		badNs := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-abc"}
		ctx := identity.WithRequester(t.Context(), badNs)
		backend := &fakeSearchBackend{}
		err := ValidateOnCreate(ctx, selectorForBackend(backend), newTeam, legacy.NoopExternalGroupReconciler{})
		require.True(t, apierrors.IsInternalError(err), "expected internal error, got %v", err)
		require.Nil(t, backend.lastQuery)
	})
}

func TestValidateOnUpdate_TitleUniqueness(t *testing.T) {
	requester := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgRole: identity.RoleAdmin, Namespace: "stacks-1"}
	for _, tt := range []struct {
		name     string
		oldTitle string
		title    string
		hits     []iamv0alpha1.GetSearchTeamsTeamHit
		conflict bool
	}{
		{name: "taken title", oldTitle: "Old", title: "Taken", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-2"}}, conflict: true},
		{name: "unchanged title", oldTitle: "Same", title: "Same", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-2"}}},
		{name: "free title", oldTitle: "Old", title: "Free"},
		{name: "case-only rename", oldTitle: "MyTeam", title: "myteam", hits: []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-1"}}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), requester)
			old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: tt.oldTitle}}
			obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: tt.title}}
			backend := &fakeSearchBackend{hits: tt.hits}
			err := ValidateOnUpdate(ctx, selectorForBackend(backend), obj, old, legacy.NoopExternalGroupReconciler{})
			if tt.conflict {
				require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
			} else {
				require.NoError(t, err)
			}
			if tt.title == tt.oldTitle {
				require.Nil(t, backend.lastQuery)
			} else {
				require.Equal(t, &SearchQuery{Namespace: "stacks-1", Title: tt.title, Limit: 2, Page: 1}, backend.lastQuery)
				require.True(t, backend.lastRequester.IsIdentityType(types.TypeAccessPolicy))
			}
		})
	}

	t.Run("hits reported without attributable rows is not a conflict", func(t *testing.T) {
		ctx := identity.WithRequester(t.Context(), requester)
		old := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "Old"}}
		obj := &iamv0alpha1.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1"}, Spec: iamv0alpha1.TeamSpec{Title: "New"}}
		backend := &fakeSearchBackend{searchFunc: func(context.Context, SearchQuery) (*iamv0alpha1.GetSearchTeamsResponse, error) {
			return &iamv0alpha1.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{TotalHits: 1}}, nil
		}}
		err := ValidateOnUpdate(ctx, selectorForBackend(backend), obj, old, legacy.NoopExternalGroupReconciler{})
		require.NoError(t, err)
	})
}

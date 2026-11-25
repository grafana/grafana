package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/login"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
)

type fakeAuthLabelProvider struct {
	modules map[int64]string
	err     error
	queries []login.GetUserLabelsQuery
}

func (f *fakeAuthLabelProvider) GetUsersRecentlyUsedLabel(_ context.Context, q login.GetUserLabelsQuery) (map[int64]string, error) {
	f.queries = append(f.queries, q)
	return f.modules, f.err
}

func TestSearchAuthLabels(t *testing.T) {
	hits := func() []iamv0.GetSearchUsersUserHit {
		return []iamv0.GetSearchUsersUserHit{
			{Name: "a", InternalId: 1},
			{Name: "b", InternalId: 2},
			{Name: "c", InternalId: 3},
		}
	}

	tests := []struct {
		name        string
		provider    *fakeAuthLabelProvider
		wantLabels  map[string][]string
		wantQueries int
	}{
		{
			name:        "maps most recent module to label and leaves unknown users empty",
			provider:    &fakeAuthLabelProvider{modules: map[int64]string{1: "ldap", 2: "github"}},
			wantLabels:  map[string][]string{"a": {"LDAP"}, "b": {"GitHub"}, "c": nil},
			wantQueries: 1,
		},
		{
			name:        "lookup error does not fail the search",
			provider:    &fakeAuthLabelProvider{err: errors.New("boom")},
			wantLabels:  map[string][]string{"a": nil, "b": nil, "c": nil},
			wantQueries: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			backend := &fakeSearchBackend{SearchFunc: func(context.Context, SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
				res := iamv0.NewGetSearchUsersResponse()
				res.Hits = hits()
				res.TotalHits = int64(len(res.Hits))
				return res, nil
			}}
			handler := NewSearchHandler(tracing.NewNoopTracerService(), selectorForBackend(backend), nil, tc.provider)

			req := httptest.NewRequest(http.MethodGet, "/searchUsers", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "default"}))
			rr := httptest.NewRecorder()
			handler.DoSearch(rr, req)
			require.Equal(t, http.StatusOK, rr.Code)

			var res iamv0.GetSearchUsersResponse
			require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &res))
			got := map[string][]string{}
			for _, h := range res.Hits {
				got[h.Name] = h.AuthLabels
			}
			require.Equal(t, tc.wantLabels, got)

			require.Len(t, tc.provider.queries, tc.wantQueries)
			require.ElementsMatch(t, []int64{1, 2, 3}, tc.provider.queries[0].UserIDs)
		})
	}
}

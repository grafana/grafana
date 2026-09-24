package resource

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

func TestShouldUseSearchForList(t *testing.T) {
	tests := map[string]struct {
		disableSearch   bool
		allowlist       []string
		noRegistry      bool
		req             *resourcepb.ListRequest
		expectedAllowed bool
	}{
		"false when no search client": {
			disableSearch: true,
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when source is not store": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_HISTORY,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when no field or label selectors": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
				},
			},
			expectedAllowed: false,
		},
		"true when no selectors and resource is allowlisted": {
			allowlist: []string{"advisor.grafana.app/advisors"},
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
				},
			},
			expectedAllowed: true,
		},
		"false when resource version is set": {
			allowlist: []string{"advisor.grafana.app/advisors"},
			req: &resourcepb.ListRequest{
				Source:          resourcepb.ListRequest_STORE,
				ResourceVersion: 42,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
				},
			},
			expectedAllowed: false,
		},
		"false when list has a name": {
			allowlist: []string{"advisor.grafana.app/advisors"},
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "named"},
				},
			},
			expectedAllowed: false,
		},
		"false when no selectors and resource is not allowlisted": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
				},
			},
			expectedAllowed: false,
		},
		"false when keys only": {
			allowlist: []string{"advisor.grafana.app/advisors"},
			req: &resourcepb.ListRequest{
				Source:   resourcepb.ListRequest_STORE,
				KeysOnly: true,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
				},
			},
			expectedAllowed: false,
		},
		"false when the list is cross-namespace": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Group: "advisor.grafana.app"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
					Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
				},
			},
			expectedAllowed: false,
		},
		"true when store, labels only, and search client": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app"},
					Labels: []*resourcepb.Requirement{{Key: "alerting.grafana.app/has-rules", Operator: "=", Values: []string{"true"}}},
				},
			},
			expectedAllowed: true,
		},
		"false when version match exact": {
			req: &resourcepb.ListRequest{
				Source:         resourcepb.ListRequest_STORE,
				VersionMatchV2: resourcepb.ResourceVersionMatchV2_Exact,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when version match not older than": {
			req: &resourcepb.ListRequest{
				Source:         resourcepb.ListRequest_STORE,
				VersionMatchV2: resourcepb.ResourceVersionMatchV2_NotOlderThan,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"true when store, fields, and search client": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: true,
		},
		"false when group has no kinds in manifest": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "provisioning.grafana.app"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when fields are selected on a group with no manifest": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
				},
			},
			expectedAllowed: false,
		},
		"true when labels only on a group with no manifest": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
					Labels: []*resourcepb.Requirement{{Key: "only", Operator: "=", Values: []string{"last"}}},
				},
			},
			expectedAllowed: true,
		},
		"true when no selectors and an allowlisted resource has no manifest": {
			allowlist: []string{"mobile.ext.grafana.app/mobileusersettings"},
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
				},
			},
			expectedAllowed: true,
		},
		"false when continuing a list that started on the store scan": {
			req: &resourcepb.ListRequest{
				Source:        resourcepb.ListRequest_STORE,
				NextPageToken: ContinueToken{Namespace: "nsx", Name: "item-42", ResourceVersion: 7}.String(),
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
					Labels: []*resourcepb.Requirement{{Key: "only", Operator: "=", Values: []string{"last"}}},
				},
			},
			expectedAllowed: false,
		},
		"false when continuing a list that started on the SQL store scan": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				// The SQL backend records a row offset, not a name, and under a key this
				// package does not decode.
				NextPageToken: base64.StdEncoding.EncodeToString([]byte(`{"o":500,"v":7}`)),
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
					Labels: []*resourcepb.Requirement{{Key: "only", Operator: "=", Values: []string{"last"}}},
				},
			},
			expectedAllowed: false,
		},
		"true when continuing a list that started on search": {
			req: &resourcepb.ListRequest{
				Source:        resourcepb.ListRequest_STORE,
				NextPageToken: ContinueToken{SearchAfter: []string{"s1"}, ResourceVersion: 7}.String(),
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileusersettings"},
					Labels: []*resourcepb.Requirement{{Key: "only", Operator: "=", Values: []string{"last"}}},
				},
			},
			expectedAllowed: true,
		},
		"true when a kind outside the compiled-in manifests declares the field": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "mobile.ext.grafana.app", Resource: "mobileverificationtokens"},
					Fields: []*resourcepb.Requirement{{Key: "spec.token", Operator: "=", Values: []string{"t1"}}},
				},
			},
			expectedAllowed: true,
		},
		"false when the kind declares no such field": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
					Fields: []*resourcepb.Requirement{{Key: "spec.undeclared", Operator: "=", Values: []string{"x"}}},
				},
			},
			expectedAllowed: false,
		},
		"false when one of several fields is undeclared": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
					Fields: []*resourcepb.Requirement{
						{Key: "spec.foo", Operator: "=", Values: []string{"bar"}},
						{Key: "spec.undeclared", Operator: "=", Values: []string{"x"}},
					},
				},
			},
			expectedAllowed: false,
		},
		"false when no declarations are available": {
			noRegistry: true,
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
				},
			},
			expectedAllowed: false,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			s := &server{}
			if !tc.disableSearch {
				s.searchClient = &stubSearchClient{}
			}
			allowed := make(map[string]bool, len(tc.allowlist))
			for _, resource := range tc.allowlist {
				allowed[resource] = true
			}
			s.searchBackedListResources = SearchBackedListConfig{AllowedResources: allowed}
			if !tc.noRegistry {
				// Stands in for what a manifest watcher would load, including a kind this
				// binary was not compiled with.
				s.manifestSearchFields = NewSearchFieldsRegistry(map[LowerGroupResource][]string{
					NewLowerGroupResource("advisor.grafana.app", "advisors"):                    {"spec.foo"},
					NewLowerGroupResource("mobile.ext.grafana.app", "mobileverificationtokens"): {"spec.token"},
				}, nil, nil)
			}

			require.Equal(t, tc.expectedAllowed, s.shouldUseSearchForList(tc.req))
		})
	}
}

func TestFilterSelectors(t *testing.T) {
	tests := map[string]struct {
		req           *resourcepb.ListRequest
		wantFieldKeys []string
	}{
		"removes metadata.namespace and keep valid field": {
			req: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{
						{Key: "metadata.namespace", Operator: "=", Values: []string{"ns"}},
						{Key: "spec.foo", Operator: "="},
					},
				},
			},
			wantFieldKeys: []string{"spec.foo"},
		},
		"removes multiple unsupported fields": {
			req: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{
						{Key: "metadata.namespace", Operator: "=", Values: []string{"ns", "other"}},
						{Key: "spec.foo", Operator: "!="},
					},
				},
			},
			wantFieldKeys: []string{},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			out := filterSelectors(tc.req)

			gotKeys := make([]string, 0, len(out.Options.Fields))
			for _, f := range out.Options.Fields {
				gotKeys = append(gotKeys, f.Key)
			}
			require.Equal(t, tc.wantFieldKeys, gotKeys)
		})
	}
}

func TestFilterSelectors_Labels(t *testing.T) {
	req := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: "nsx"},
			Labels: []*resourcepb.Requirement{
				{Key: "keep-equals", Operator: "="},
				{Key: "keep-double-equals", Operator: "=="},
				{Key: "keep-in", Operator: "in"},
				{Key: "keep-notin", Operator: "notin"},
				{Key: "drop-not-equals", Operator: "!="},
				{Key: "drop-exists", Operator: "exists"},
			},
		},
	}

	got := make([]string, 0, len(req.Options.Labels))
	for _, l := range filterSelectors(req).Options.Labels {
		got = append(got, l.Key)
	}
	require.Equal(t, []string{"keep-equals", "keep-double-equals", "keep-in", "keep-notin"}, got)
}

func TestTokenFromOtherListPath(t *testing.T) {
	searchToken := &ContinueToken{SearchAfter: []string{"s1"}, ResourceVersion: 100}
	scanToken := &ContinueToken{Name: "a", ResourceVersion: 100}
	// The SQL backend records a row offset under a key this type does not decode, so
	// its token looks empty here and still has to count as a store token.
	sqlScanToken := &ContinueToken{ResourceVersion: 100}

	require.False(t, tokenFromOtherListPath(searchToken, true))
	require.True(t, tokenFromOtherListPath(searchToken, false))
	require.True(t, tokenFromOtherListPath(scanToken, true))
	require.False(t, tokenFromOtherListPath(scanToken, false))
	require.True(t, tokenFromOtherListPath(sqlScanToken, true))
	require.False(t, tokenFromOtherListPath(sqlScanToken, false))
}

func TestDecodeListSearchRows(t *testing.T) {
	const resourceVersion = int64(1958241239561142273)
	key := &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}
	want := []listSearchRow{{key: key, resourceVersion: resourceVersion, sortFields: []string{"title", "a"}}}

	for _, test := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
	}{
		{
			name: "unspecified resource table",
			response: &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
				Rows: []*resourcepb.ResourceTableRow{{
					Key: key, ResourceVersion: resourceVersion, SortFields: []string{"title", "a"},
				}},
			}},
		},
		{
			name: "explicit resource table",
			response: &resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
				Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{
					Key: key, ResourceVersion: resourceVersion, SortFields: []string{"title", "a"},
				}}},
			},
		},
		{
			name: "field values",
			response: &resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows: []*resourcepb.ResourceSearchRow{{
					Key: key, ResourceVersion: resourceVersion, SortFields: []string{"title", "a"},
				}},
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			rows, err := decodeListSearchRows(test.response)
			require.NoError(t, err)
			require.Equal(t, want, rows)
		})
	}
}

func TestDecodeListSearchRowsRejectsMalformedResponses(t *testing.T) {
	for _, test := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
	}{
		{name: "nil response"},
		{
			name:     "unsupported format",
			response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_ResultFormat(99)},
		},
		{
			name: "table row without key",
			response: &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
				Rows: []*resourcepb.ResourceTableRow{{}},
			}},
		},
		{
			name: "field-value row without key",
			response: &resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows:         []*resourcepb.ResourceSearchRow{{}},
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := decodeListSearchRows(test.response)
			require.Error(t, err)
		})
	}
}

func TestListWithSelectors(t *testing.T) {
	searchServerRv := int64(100)

	t.Run("label selectors reach search unprefixed, fields are prefixed", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{ResourceVersion: searchServerRv}}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
				Labels: []*resourcepb.Requirement{{Key: "alerting.grafana.app/has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		_, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, searchClient.last)
		// The search backend prefixes label keys itself, so they are passed through.
		require.Equal(t, "alerting.grafana.app/has-rules", searchClient.last.Options.Labels[0].Key)
		require.Equal(t, SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.foo", searchClient.last.Options.Fields[0].Key)
		require.Equal(t, []string{SEARCH_FIELD_RV}, searchClient.last.Fields)
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, searchClient.last.ResultFormat)
	})

	t.Run("returns an embedded search error", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
			Error: NewBadRequestError("search failed"),
		}}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.Equal(t, int32(http.StatusBadRequest), resp.Error.Code)
		require.Equal(t, "search failed", resp.Error.Message)
	})

	t.Run("asks for the store scan when the index lacks a requested field", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
			Error: NewSelectableFieldNotIndexedError([]string{SEARCH_SELECTABLE_FIELDS_PREFIX + "spec.foo"}),
		}}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.ErrorIs(t, err, errSearchCannotAnswerList)
		require.Nil(t, resp)
	})

	t.Run("keeps the error mid-pagination, where the store scan cannot resume", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
			Error: NewSelectableFieldNotIndexedError([]string{SEARCH_SELECTABLE_FIELDS_PREFIX + "spec.foo"}),
		}}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit:         10,
			NextPageToken: ContinueToken{SearchAfter: []string{"s1"}, ResourceVersion: searchServerRv}.String(),
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.True(t, IsSelectableFieldNotIndexed(resp.Error))
	})

	t.Run("returns transport errors directly", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchErr := errors.New("search unavailable")
		s := createTestServer(&stubSearchClient{err: searchErr}, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.ErrorIs(t, err, searchErr)
		require.Nil(t, resp)
	})

	t.Run("rejects a continue token from the store path", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		s := createTestServer(&stubSearchClient{resp: &resourcepb.ResourceSearchResponse{}}, 1024)
		req := &resourcepb.ListRequest{
			Limit:         10,
			NextPageToken: ContinueToken{Name: "a", ResourceVersion: searchServerRv}.String(),
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.Equal(t, int32(http.StatusBadRequest), resp.Error.Code)
	})

	for _, tc := range []struct {
		name           string
		limit          int64
		forbidden      map[string]struct{}
		lastSortFields []string
		batched        bool
		emptyResults   bool
		inexactTotal   bool
		previousRV     int64
		wantItems      int
		wantToken      bool
	}{
		{name: "full page with a forbidden last row continues", limit: 2, forbidden: map[string]struct{}{"b": {}}, lastSortFields: []string{"s2"}, wantItems: 1, wantToken: true},
		{name: "full page with all rows forbidden continues", limit: 2, forbidden: map[string]struct{}{"a": {}, "b": {}}, lastSortFields: []string{"s2"}, wantToken: true},
		{name: "full batched page with a forbidden last row continues", limit: 2, forbidden: map[string]struct{}{"b": {}}, lastSortFields: []string{"s2"}, batched: true, wantItems: 1, wantToken: true},
		{name: "full batched page with all rows forbidden continues", limit: 2, forbidden: map[string]struct{}{"a": {}, "b": {}}, lastSortFields: []string{"s2"}, batched: true, wantToken: true},
		{name: "filtered continuation preserves original list rv", limit: 2, forbidden: map[string]struct{}{"b": {}}, lastSortFields: []string{"s2"}, previousRV: 50, wantItems: 1, wantToken: true},
		{name: "filtered full page without final sort fields has no token", limit: 2, forbidden: map[string]struct{}{"b": {}}, wantItems: 1},
		{name: "filtered unlimited page has no token", forbidden: map[string]struct{}{"b": {}}, lastSortFields: []string{"s2"}, wantItems: 1},
		{name: "empty search results have no token", limit: 2, emptyResults: true},
		{name: "short page with an inexact total continues", limit: 10, lastSortFields: []string{"s2"}, inexactTotal: true, wantItems: 2, wantToken: true},
		{name: "short page with an exact total ends", limit: 10, lastSortFields: []string{"s2"}, wantItems: 2},
		{name: "short filtered page with an inexact total continues", limit: 10, forbidden: map[string]struct{}{"a": {}, "b": {}}, lastSortFields: []string{"s2"}, batched: true, inexactTotal: true, wantToken: true},
		{name: "short page with an inexact total without sort fields ends", limit: 10, inexactTotal: true, wantItems: 2},
		{name: "empty search results with an inexact total end", limit: 10, emptyResults: true, inexactTotal: true},
		{name: "unlimited page with an inexact total ends", lastSortFields: []string{"s2"}, inexactTotal: true, wantItems: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithServiceIdentityContext(context.Background(), 1)
			rows := []*resourcepb.ResourceTableRow{
				{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1, SortFields: []string{"s1"}},
				{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2, SortFields: tc.lastSortFields},
			}
			if tc.emptyResults {
				rows = nil
			}
			searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				TotalHitsExact:  !tc.inexactTotal,
				Results:         &resourcepb.ResourceTable{Rows: rows},
			}}
			s := createTestServer(searchClient, 1024)
			s.backend = &fakeBackend{forbidden: tc.forbidden}
			if tc.batched {
				s.backend = &batchFakeBackend{fakeBackend: &fakeBackend{}}
				s.access = denyByNameAccess{deny: tc.forbidden}
			}
			req := &resourcepb.ListRequest{
				Limit: tc.limit,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
				},
			}
			wantRV := searchServerRv
			if tc.previousRV > 0 {
				var err error
				req.NextPageToken, err = NewSearchContinueToken([]string{"s0"}, tc.previousRV)
				require.NoError(t, err)
				wantRV = tc.previousRV
			}

			resp, err := s.listWithSelectors(ctx, req)
			require.NoError(t, err)
			require.Nil(t, resp.Error)
			require.Len(t, resp.Items, tc.wantItems)
			if tc.wantItems > 0 {
				require.Equal(t, int64(1), resp.Items[0].ResourceVersion)
			}
			require.Equal(t, wantRV, resp.ResourceVersion)
			if tc.wantToken {
				require.NotEmpty(t, resp.NextPageToken)
				token, err := GetContinueToken(resp.NextPageToken)
				require.NoError(t, err)
				require.Equal(t, []string{"s2"}, token.SearchAfter)
				require.Equal(t, wantRV, token.ResourceVersion)

				searchClient.resp = &resourcepb.ResourceSearchResponse{ResourceVersion: searchServerRv + 1}
				req.NextPageToken = resp.NextPageToken
				lastPage, err := s.listWithSelectors(ctx, req)
				require.NoError(t, err)
				require.Nil(t, lastPage.Error)
				require.Empty(t, lastPage.Items)
				require.Empty(t, lastPage.NextPageToken)
				require.Equal(t, []string{"s2"}, searchClient.last.SearchAfter)
				require.Equal(t, wantRV, lastPage.ResourceVersion)
			} else {
				require.Empty(t, resp.NextPageToken)
			}
		})
	}

	t.Run("a page left empty by authorization returns no items and no token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				TotalHitsExact:  true,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1, SortFields: []string{"s1"}},
						{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2, SortFields: []string{"s2"}},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		s.backend = &fakeBackend{forbidden: map[string]struct{}{"a": {}, "b": {}}}
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.Empty(t, resp.Items)
		require.Empty(t, resp.NextPageToken)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
	})

	t.Run("a single field-value result preserves exact index rv and has no next page token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		const exactResourceVersion = int64(1958241239561142273)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				TotalHitsExact:  true,
				ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows: []*resourcepb.ResourceSearchRow{
					{
						Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
						ResourceVersion: exactResourceVersion,
						SortFields:      []string{"s1"},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, exactResourceVersion, resp.Items[0].ResourceVersion)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Empty(t, resp.NextPageToken)
	})

	t.Run("skips results when Read returns forbidden", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
					},
				},
			},
		}
		s := &server{
			searchClient:     searchClient,
			backend:          &fakeBackend{forbidden: map[string]struct{}{"a": {}}},
			access:           claims.FixedAccessClient(true),
			queue:            scheduler.NewNoopQueue(),
			queueConfig:      QueueConfig{Timeout: time.Second, MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 1},
			maxPageSizeBytes: 1024,
			log:              log.NewNopLogger(),
		}
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
	})

	t.Run("first field-value page uses sort fields for the next page token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows: []*resourcepb.ResourceSearchRow{
					{
						Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
						ResourceVersion: 1,
						SortFields:      []string{"s1"},
					},
					{
						Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
						ResourceVersion: 2,
						SortFields:      []string{"s2"},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 1,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Len(t, resp.Items, 1)
		require.NotEmpty(t, resp.NextPageToken)
		token, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.NotNil(t, token)
		require.Equal(t, []string{"s1"}, token.SearchAfter)
		require.Equal(t, searchServerRv, token.ResourceVersion)
	})

	t.Run("can handle pagination when list request has a token present", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		continueToken, err := NewSearchContinueToken([]string{"s1"}, searchServerRv)
		require.NoError(t, err)

		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "c"},
							ResourceVersion: 2,
							SortFields:      []string{"s3"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit:         1,
			NextPageToken: continueToken,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Len(t, resp.Items, 1)
		require.NotEmpty(t, resp.NextPageToken)

		parsedToken, err := GetContinueToken(continueToken)
		require.NoError(t, err)
		require.NotNil(t, searchClient.last)
		require.Equal(t, parsedToken.SearchAfter, searchClient.last.SearchAfter)
		require.Equal(t, parsedToken.SearchBefore, searchClient.last.SearchBefore)

		token, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.NotNil(t, token)
		require.Equal(t, []string{"s2"}, token.SearchAfter)
		require.Equal(t, searchServerRv, token.ResourceVersion)
	})

	t.Run("will paginate when max page size bytes is reached", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 5)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.NotEmpty(t, resp.NextPageToken)

		parsedToken, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, []string{"s1"}, parsedToken.SearchAfter)
		require.Equal(t, searchServerRv, parsedToken.ResourceVersion)
	})

	t.Run("a search with no rows returns an empty list", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{ResourceVersion: searchServerRv},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)

		require.NoError(t, err)
		require.Nil(t, resp.Error)
		require.Empty(t, resp.Items)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
	})
}

// countingListBackend records how often the store scan was used.
type countingListBackend struct {
	*fakeBackend
	listCalls int
}

func (b *countingListBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	b.listCalls++
	return 1, nil
}

func TestListFallsBackToStoreWhenIndexLacksField(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	backend := &countingListBackend{fakeBackend: &fakeBackend{}}
	s := createTestServer(&stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
		Error: NewSelectableFieldNotIndexedError([]string{SEARCH_SELECTABLE_FIELDS_PREFIX + "spec.foo"}),
	}}, 1024)
	s.backend = backend

	resp, err := s.List(ctx, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_STORE,
		Limit:  10,
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors"},
			Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
		},
	})
	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Equal(t, 1, backend.listCalls, "the store scan must serve the request the index refused")
}

func TestListWithSelectorsUsesBatchReadsAndAuthorization(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{
			{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1},
			{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2},
		}},
	}}
	backend := &batchFakeBackend{fakeBackend: &fakeBackend{}}
	access := denyByNameAccess{deny: map[string]struct{}{"b": {}}}
	s := createTestServer(searchClient, 1024)
	s.backend = backend
	s.access = access

	resp, err := s.listWithSelectors(ctx, &resourcepb.ListRequest{
		Limit: 10,
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res"},
			Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
		},
	})

	require.NoError(t, err)
	require.Len(t, resp.Items, 1)
	require.Equal(t, 1, backend.batchCalls)
	require.Zero(t, backend.readCalls)
}

func TestListUsesSearchForAnAllowlistedResourceWithoutSelectors(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{ResourceVersion: 100}}
	s := createTestServer(searchClient, 1024)
	s.searchBackedListResources = SearchBackedListConfig{AllowedResources: map[string]bool{
		"advisor.grafana.app/advisors": true,
	}}

	resp, err := s.List(ctx, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_STORE,
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: "nsx",
			Group:     "advisor.grafana.app",
			Resource:  "advisors",
		}},
	})

	require.NoError(t, err)
	require.Empty(t, resp.Items)
	require.NotNil(t, searchClient.last)
	require.Empty(t, searchClient.last.Options.Fields)
	require.Empty(t, searchClient.last.Options.Labels)
}

func TestListWithSelectorsStopsReadingAtPageCutoff(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)

	rows := make([]*resourcepb.ResourceTableRow, 0, 30)
	for i := 0; i < cap(rows); i++ {
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key:        &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: fmt.Sprintf("item-%d", i)},
			SortFields: []string{fmt.Sprintf("s%d", i)},
		})
	}
	searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		Results:         &resourcepb.ResourceTable{Rows: rows},
	}}
	backend := &batchFakeBackend{fakeBackend: &fakeBackend{}}

	// Each response is five bytes, so the byte cutoff is crossed by the third item.
	s := createTestServer(searchClient, 11)
	s.backend = backend

	resp, err := s.listWithSelectors(ctx, &resourcepb.ListRequest{
		Limit: int64(len(rows)),
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res"},
			Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
		},
	})

	require.NoError(t, err)
	require.Len(t, resp.Items, 3)
	require.NotEmpty(t, resp.NextPageToken, "a cut-off page must still page forward")
	require.Equal(t, 1, backend.batchCalls)
	require.Equal(t, searchReadChunkSize, backend.batchReqs)
	require.Equal(t, []string{"item-0", "item-1", "item-2"}, backend.pulledNames)
}

// denyByNameAccess allows everything except names in deny.
type denyByNameAccess struct{ deny map[string]struct{} }

func (a denyByNameAccess) Check(_ context.Context, _ claims.AuthInfo, req claims.CheckRequest, _ string) (claims.CheckResponse, error) {
	_, denied := a.deny[req.Name]
	return claims.CheckResponse{Allowed: !denied}, nil
}

func (denyByNameAccess) Compile(context.Context, claims.AuthInfo, claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return func(string, string) bool { return true }, nil, nil
}

func (a denyByNameAccess) BatchCheck(_ context.Context, _ claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	results := make(map[string]claims.BatchCheckResult, len(req.Checks))
	for _, c := range req.Checks {
		_, denied := a.deny[c.Name]
		results[c.CorrelationID] = claims.BatchCheckResult{Allowed: !denied}
	}
	return claims.BatchCheckResponse{Results: results}, nil
}

func TestListWithSelectorsAuthorizesBatchedRows(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{
			{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1, SortFields: []string{"s1"}},
			{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2, SortFields: []string{"s2"}},
			{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "c"}, ResourceVersion: 3, SortFields: []string{"s3"}},
		}},
	}}
	backend := &batchFakeBackend{fakeBackend: &fakeBackend{}}
	s := createTestServer(searchClient, 1024)
	s.backend = backend
	s.access = denyByNameAccess{deny: map[string]struct{}{"b": {}}}

	resp, err := s.listWithSelectors(ctx, &resourcepb.ListRequest{
		Limit: 10,
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res"},
			Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
		},
	})

	require.NoError(t, err)
	require.Len(t, resp.Items, 2, "the unauthorized row must be filtered out")
	// Bodies are read in one batch; authorization is applied per row on top.
	require.Equal(t, 1, backend.batchCalls)
}

func TestListWithSelectorsAuthorizesErroredRows(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	newSearch := func() *stubSearchClient {
		return &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
			ResourceVersion: 100,
			Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{
				{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1, SortFields: []string{"s1"}},
				{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2, SortFields: []string{"s2"}},
			}},
		}}
	}
	req := func() *resourcepb.ListRequest {
		return &resourcepb.ListRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res"}, Fields: []*resourcepb.Requirement{{Key: "spec.foo"}}},
		}
	}

	t.Run("runtime error on unauthorized row is logged and redacted", func(t *testing.T) {
		logger := &logtest.Fake{}
		s := createTestServer(newSearch(), 1024)
		s.backend = &batchFakeBackend{fakeBackend: &fakeBackend{}, errored: map[string]struct{}{"b": {}}}
		s.access = denyByNameAccess{deny: map[string]struct{}{"b": {}}}
		s.log = logger

		resp, err := s.listWithSelectors(ctx, req())
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
		require.Equal(t, "failed to read resource", resp.Error.Message)
		require.Empty(t, resp.Items)
		require.Equal(t, 1, logger.ErrorLogs.Calls)
		require.Equal(t, "Failed to read unauthorized search result", logger.ErrorLogs.Message)
	})

	t.Run("authorized errored row aborts the list", func(t *testing.T) {
		s := createTestServer(newSearch(), 1024)
		s.backend = &batchFakeBackend{fakeBackend: &fakeBackend{}, errored: map[string]struct{}{"b": {}}}
		// access allows everything (default FixedAccessClient(true) from createTestServer)

		resp, err := s.listWithSelectors(ctx, req())
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
	})

	t.Run("bad request aborts the list without returning partial items", func(t *testing.T) {
		s := createTestServer(newSearch(), 1024)
		s.backend = &batchFakeBackend{
			fakeBackend: &fakeBackend{},
			errors:      map[string]*resourcepb.ErrorResult{"b": NewBadRequestError("invalid request")},
		}

		resp, err := s.listWithSelectors(ctx, req())
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusBadRequest), resp.Error.Code)
		require.Empty(t, resp.Items)
	})

	t.Run("unrecognized error aborts the list without returning partial items", func(t *testing.T) {
		s := createTestServer(newSearch(), 1024)
		s.backend = &batchFakeBackend{
			fakeBackend: &fakeBackend{},
			errors:      map[string]*resourcepb.ErrorResult{"b": {Code: http.StatusConflict, Message: "conflict"}},
		}

		resp, err := s.listWithSelectors(ctx, req())
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusConflict), resp.Error.Code)
		require.Empty(t, resp.Items)
	})

	t.Run("not-found row surfaces without authorizing (not dropped on empty folder)", func(t *testing.T) {
		s := createTestServer(newSearch(), 1024)
		s.backend = &batchFakeBackend{fakeBackend: &fakeBackend{}, notFound: map[string]struct{}{"b": {}}}
		// Deny "b" too: a NotFound must still surface, not be hidden by the authz check.
		s.access = denyByNameAccess{deny: map[string]struct{}{"b": {}}}

		resp, err := s.listWithSelectors(ctx, req())
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.Equal(t, int32(http.StatusNotFound), resp.Error.Code)
	})
}

func TestListWithSelectorsSurfacesKVRuntimeFailuresBeforeAuthorization(t *testing.T) {
	tests := []struct {
		name string
		wrap func(KV) KV
	}{
		{
			name: "batch get",
			wrap: func(store KV) KV {
				return &failingBatchGetKV{KV: store, err: errors.New("storage is down")}
			},
		},
		{
			name: "body read",
			wrap: func(store KV) KV {
				return &unreadableValueKV{KV: store, nameMatch: "failed", err: errors.New("value is corrupt")}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
				opts.KvStore = tc.wrap(opts.KvStore)
			})
			rv := seedResource(t, backend, t.Context(), "failed", "folder-a")
			newServer := func() *server {
				search := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
					ResourceVersion: rv,
					Results: &resourcepb.ResourceTable{Rows: []*resourcepb.ResourceTableRow{{
						Key:             appsKey("failed"),
						ResourceVersion: rv,
						SortFields:      []string{"failed"},
					}}},
				}}
				s := createTestServer(search, 1024)
				s.backend = backend
				return s
			}
			req := &resourcepb.ListRequest{
				Limit: 1,
				Options: &resourcepb.ListOptions{
					Key:    appsKey(""),
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			}
			ctx := identity.WithServiceIdentityContext(context.Background(), 1)

			unauthorized := newServer()
			unauthorized.access = denyByNameAccess{deny: map[string]struct{}{"failed": {}}}
			resp, err := unauthorized.listWithSelectors(ctx, req)
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
			require.Equal(t, "failed to read resource", resp.Error.Message)
			require.Empty(t, resp.Items)

			authorized := newServer()
			resp, err = authorized.listWithSelectors(ctx, req)
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
		})
	}
}

func TestListWithSelectorsStopsAfterRuntimeFailure(t *testing.T) {
	var kvWrapper *failSecondBatchGetKV
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
		kvWrapper = &failSecondBatchGetKV{KV: opts.KvStore, err: errors.New("transient storage failure")}
		opts.KvStore = kvWrapper
	})

	rows := make([]*resourcepb.ResourceTableRow, 0, searchReadChunkSize+1)
	denied := make(map[string]struct{}, searchReadChunkSize)
	var listRV int64
	for i := range searchReadChunkSize + 1 {
		name := fmt.Sprintf("cross-batch-%02d", i)
		listRV = seedResource(t, backend, t.Context(), name, fmt.Sprintf("folder-%02d", i))
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key:             appsKey(name),
			ResourceVersion: listRV,
			SortFields:      []string{name},
		})
		if i < searchReadChunkSize {
			denied[name] = struct{}{}
		}
	}

	s := createTestServer(&stubSearchClient{resp: &resourcepb.ResourceSearchResponse{
		ResourceVersion: listRV,
		Results:         &resourcepb.ResourceTable{Rows: rows},
	}}, 1024)
	s.backend = backend
	s.access = denyByNameAccess{deny: denied}
	resp, err := s.listWithSelectors(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ListRequest{
		Limit: 1,
		Options: &resourcepb.ListOptions{
			Key:    appsKey(""),
			Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
		},
	})

	require.NoError(t, err)
	require.Empty(t, resp.Items)
	require.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
	require.Equal(t, "transient storage failure", resp.Error.Message)
	require.Equal(t, 2, kvWrapper.dataCalls)
}

func createTestServer(searchClient resourcepb.ResourceIndexClient, maxPageSizeBytes int) *server {
	return &server{
		searchClient:     searchClient,
		backend:          &fakeBackend{},
		access:           claims.FixedAccessClient(true),
		queue:            scheduler.NewNoopQueue(),
		queueConfig:      QueueConfig{Timeout: time.Second, MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 1},
		maxPageSizeBytes: maxPageSizeBytes,
		log:              log.NewNopLogger(),
		storageMetrics:   ProvideStorageMetrics(nil),
	}
}

type stubSearchClient struct {
	resp *resourcepb.ResourceSearchResponse
	err  error
	last *resourcepb.ResourceSearchRequest
}

func (s *stubSearchClient) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.last = req
	return s.resp, s.err
}

func (*stubSearchClient) GetStats(_ context.Context, _ *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}

func (*stubSearchClient) RebuildIndexes(_ context.Context, _ *resourcepb.RebuildIndexesRequest, _ ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, nil
}

func (*stubSearchClient) VectorSearch(_ context.Context, _ *resourcepb.VectorSearchRequest, _ ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, nil
}

func (*stubSearchClient) HybridSearch(_ context.Context, _ *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, nil
}

type fakeBackend struct {
	UnimplementedStorageBackend
	forbidden map[string]struct{}
}

func (*fakeBackend) WriteEvent(context.Context, WriteEvent) (int64, error) { return 0, nil }
func (b *fakeBackend) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if b != nil && b.forbidden != nil {
		if _, ok := b.forbidden[req.Key.Name]; ok {
			return &BackendReadResponse{
				Key:   req.Key,
				Error: &resourcepb.ErrorResult{Code: http.StatusForbidden},
			}
		}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: req.ResourceVersion,
		Value:           []byte("value"),
	}
}
func (*fakeBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (*fakeBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (*fakeBackend) ListModifiedSince(context.Context, NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(func(*ModifiedResource, error) bool) {}
}
func (*fakeBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch := make(chan *WrittenEvent)
	context.AfterFunc(ctx, func() { close(ch) })
	return ch, nil
}
func (*fakeBackend) GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error) {
	return nil, nil
}

func (*fakeBackend) GetResourceLastImportTime(context.Context, NamespacedResource) (time.Time, error) {
	return time.Time{}, nil
}

type batchFakeBackend struct {
	*fakeBackend
	errored     map[string]struct{}
	errors      map[string]*resourcepb.ErrorResult
	notFound    map[string]struct{}
	batchCalls  int
	batchReqs   int
	readCalls   int
	pulledNames []string
}

func (b *batchFakeBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	b.readCalls++
	return b.fakeBackend.ReadResource(ctx, req)
}

func (b *batchFakeBackend) BatchReadResource(_ context.Context, requests []*resourcepb.ReadRequest) (iter.Seq[*BackendReadResponse], error) {
	b.batchCalls++
	b.batchReqs += len(requests)
	return func(yield func(*BackendReadResponse) bool) {
		for _, req := range requests {
			b.pulledNames = append(b.pulledNames, req.Key.Name)
			var response *BackendReadResponse
			if _, forbidden := b.forbidden[req.Key.Name]; forbidden {
				response = &BackendReadResponse{
					Key:   req.Key,
					Error: &resourcepb.ErrorResult{Code: http.StatusForbidden},
				}
			} else if errRes, exists := b.errors[req.Key.Name]; exists {
				response = &BackendReadResponse{Key: req.Key, Error: errRes}
			} else if _, errored := b.errored[req.Key.Name]; errored {
				response = &BackendReadResponse{
					Key:   req.Key,
					Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "boom"},
				}
			} else if _, nf := b.notFound[req.Key.Name]; nf {
				response = &BackendReadResponse{Key: req.Key, Error: NewNotFoundError(req.Key)}
			} else {
				response = &BackendReadResponse{
					Key:             req.Key,
					ResourceVersion: req.ResourceVersion,
					Value:           []byte("value"),
				}
			}
			if !yield(response) {
				return
			}
		}
	}, nil
}

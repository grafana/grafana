package user

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	teamapi "github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var (
	_ rest.Storage         = (*UserTeamREST)(nil)
	_ rest.StorageMetadata = (*UserTeamREST)(nil)
	_ rest.Connecter       = (*UserTeamREST)(nil)
)

// userTeamsGetParallelism caps the number of concurrent Team Get calls when
// the search response doesn't carry the user's permission/external inline
// (the unified-storage path). Small enough that a power user on hundreds of
// teams doesn't blast the apiserver, large enough that latency is bounded.
const userTeamsGetParallelism = 8

type UserTeamREST struct {
	client     resourcepb.ResourceIndexClient
	teamGetter rest.Getter
	tracer     trace.Tracer
	features   featuremgmt.FeatureToggles
}

func NewUserTeamREST(client resourcepb.ResourceIndexClient, teamGetter rest.Getter, tracer trace.Tracer, features featuremgmt.FeatureToggles) *UserTeamREST {
	return &UserTeamREST{
		client:     client,
		teamGetter: teamGetter,
		tracer:     tracer,
		features:   features,
	}
}

// New implements rest.Storage.
func (s *UserTeamREST) New() runtime.Object {
	return &legacyiamv0.UserTeamList{}
}

// Destroy implements rest.Storage.
func (s *UserTeamREST) Destroy() {}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *UserTeamREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *UserTeamREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *UserTeamREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		//nolint:staticcheck // not migrated to OpenFeature
		if !s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesTeamsApi) {
			responder.Error(apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				name, errors.New("functionality not available")))
			return
		}

		ctx, span := s.tracer.Start(r.Context(), "user.teams")
		defer span.End()

		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
		}

		requester, err := identity.GetRequester(ctx)
		if err != nil {
			responder.Error(apierrors.NewUnauthorized("no identity found"))
			return
		}

		limit := common.DefaultListLimit
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if limit > common.MaxListLimit {
			http.Error(w, fmt.Sprintf("limit parameter exceeds maximum of %d", common.MaxListLimit), http.StatusBadRequest)
			return
		}
		if limit < 1 {
			limit = common.DefaultListLimit
		}

		// Keyset pagination: the caller echoes back the previous response's
		// metadata.continue token. We sort by team name (deterministic across
		// requests) and resume after the last team name seen on the previous
		// page. This is stable under concurrent member changes — unlike
		// offset/page which silently shift when items insert/delete.
		var searchAfter []string
		if cont := queryParams.Get("continue"); cont != "" {
			token, err := resource.GetContinueToken(cont)
			if err != nil {
				http.Error(w, "invalid continue token", http.StatusBadRequest)
				return
			}
			searchAfter = token.SearchAfter
		}

		span.SetAttributes(attribute.Int("limit", limit),
			attribute.String("name", name),
			attribute.Bool("continue", len(searchAfter) > 0))

		teamGR := iamv0alpha1.TeamResourceInfo.GroupResource()
		searchRequest := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     teamGR.Group,
					Resource:  teamGR.Resource,
					Namespace: requester.GetNamespace(),
				},
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_MEMBERS,
					Operator: string(selection.Equals),
					Values:   []string{name},
				}},
			},
			Limit: int64(limit),
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: resource.SEARCH_FIELD_NAME},
			},
			SearchAfter: searchAfter,
			Explain:     queryParams.Has("explain") && queryParams.Get("explain") != "false",
		}

		result, err := s.client.Search(ctx, searchRequest)
		if err != nil {
			responder.Error(apierrors.NewInternalError(err))
			return
		}
		if result != nil && result.Error != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)))
			return
		}
		if result == nil || result.Results == nil || len(result.Results.Rows) == 0 {
			responder.Object(http.StatusOK, &iamv0alpha1.GetUserTeamsResponse{})
			return
		}

		rows := result.Results.Rows
		permIdx, externalIdx := cellIndexes(result.Results.Columns)
		items, err := s.buildItems(common.WithSubresourceNamespace(ctx), rows, name, permIdx, externalIdx)
		if err != nil {
			responder.Error(apierrors.NewInternalError(err))
			return
		}

		response := &iamv0alpha1.GetUserTeamsResponse{
			GetUserTeamsBody: iamv0alpha1.GetUserTeamsBody{Items: items},
		}
		// Emit a continue token only when we filled the page — that's the
		// only case the caller should ask for more. The token encodes the
		// last row's sort_fields, which the search backend will resolve
		// into a "name > lastSeen" cursor on the next request.
		if int64(len(rows)) >= int64(limit) {
			lastSort := rows[len(rows)-1].GetSortFields()
			if len(lastSort) > 0 {
				token, err := resource.NewSearchContinueToken(lastSort, result.ResourceVersion)
				if err != nil {
					responder.Error(apierrors.NewInternalError(err))
					return
				}
				response.ListMeta.Continue = token
			}
		}
		responder.Object(http.StatusOK, response)
	}), nil
}

// buildItems projects search-result rows to UserTeam items. When the row
// carries permission and external as inline cells (legacy-adapter path) we
// build directly from them; otherwise we fan out parallel Team Gets to
// extract the user's member entry from spec.members (unified path).
func (s *UserTeamREST) buildItems(ctx context.Context, rows []*resourcepb.ResourceTableRow, userName string, permIdx, externalIdx int) ([]iamv0alpha1.GetUserTeamsUserTeam, error) {
	items := make([]iamv0alpha1.GetUserTeamsUserTeam, len(rows))
	hasInlineCells := permIdx >= 0 && externalIdx >= 0

	if hasInlineCells {
		for i, row := range rows {
			if row.Key == nil {
				continue
			}
			items[i] = iamv0alpha1.GetUserTeamsUserTeam{
				User:       userName,
				Team:       row.Key.Name,
				Permission: cellString(row, permIdx),
				External:   cellBool(row, externalIdx),
			}
		}
		return compact(items), nil
	}

	// Unified-storage path: the index doesn't carry per-user permission/external,
	// so we fan out one Get per matching team to read spec.members. Capped
	// concurrency keeps a power user on many teams from blasting the apiserver.
	// Each goroutine writes to its own items[i] slot — slice writes to distinct
	// indices are safe under the Go memory model — and the compact() pass
	// below runs after g.Wait() so it sees a fully-published view.
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(userTeamsGetParallelism)
	for i, row := range rows {
		if row.Key == nil {
			continue
		}
		g.Go(func() error {
			teamObj, err := s.teamGetter.Get(gctx, row.Key.Name, &metav1.GetOptions{})
			if apierrors.IsNotFound(err) {
				return nil // team disappeared mid-flight; skip
			}
			if err != nil {
				return err
			}
			t, ok := teamObj.(*iamv0alpha1.Team)
			if !ok {
				return nil
			}
			m, ok := findMember(t, userName)
			if !ok {
				return nil
			}
			items[i] = iamv0alpha1.GetUserTeamsUserTeam{
				User:       userName,
				Team:       row.Key.Name,
				Permission: string(m.Permission),
				External:   m.External,
			}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return compact(items), nil
}

func findMember(t *iamv0alpha1.Team, userName string) (iamv0alpha1.TeamTeamMember, bool) {
	for _, m := range t.Spec.Members {
		if m.Name == userName {
			return m, true
		}
	}
	return iamv0alpha1.TeamTeamMember{}, false
}

// cellIndexes resolves the column indexes for the permission and external
// cells emitted by LegacyUserTeamsSearchClient. Returns -1, -1 when the
// search response doesn't include them (unified-storage path).
func cellIndexes(cols []*resourcepb.ResourceTableColumnDefinition) (permission, external int) {
	permission, external = -1, -1
	for i, c := range cols {
		if c == nil {
			continue
		}
		switch c.Name {
		case teamapi.TeamMembersColPermission:
			permission = i
		case teamapi.TeamMembersColExternal:
			external = i
		}
	}
	return permission, external
}

func cellString(row *resourcepb.ResourceTableRow, idx int) string {
	if idx < 0 || idx >= len(row.Cells) {
		return ""
	}
	return string(row.Cells[idx])
}

func cellBool(row *resourcepb.ResourceTableRow, idx int) bool {
	if idx < 0 || idx >= len(row.Cells) {
		return false
	}
	v, _ := strconv.ParseBool(string(row.Cells[idx]))
	return v
}

// compact drops zero-value items so callers see a contiguous slice when
// some rows were skipped (team not found, no member entry, etc.).
func compact(items []iamv0alpha1.GetUserTeamsUserTeam) []iamv0alpha1.GetUserTeamsUserTeam {
	out := items[:0]
	for _, it := range items {
		if it.Team == "" {
			continue
		}
		out = append(out, it)
	}
	return out
}

// NewConnectOptions implements rest.Connecter.
func (s *UserTeamREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *UserTeamREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

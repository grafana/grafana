package team

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// Column names emitted by LegacyUserTeamsSearchClient. The user-teams REST
// handler reads these cells inline so it doesn't need a follow-up Team Get.
const (
	TeamMembersColPermission = "permission"
	TeamMembersColExternal   = "external"
)

var teamMembersResultColumns = []*resourcepb.ResourceTableColumnDefinition{
	{Name: TeamMembersColPermission, Type: resourcepb.ResourceTableColumnDefinition_STRING},
	{Name: TeamMembersColExternal, Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN},
}

// LegacyUserTeamsSearchClient answers Team-index search requests that filter
// by `members=<userUID>`. Used as the legacy adapter for the user-teams
// subresource when the Team unified search index isn't primary — e.g. dual
// writer Mode 0/1, where membership data lives in the legacy `team_member`
// table.
//
// Each emitted row carries the requesting user's permission and external
// flag inline as cells, so callers can build a response without an extra
// Team Get round trip.
type LegacyUserTeamsSearchClient struct {
	resourcepb.ResourceIndexClient
	store  legacy.LegacyIdentityStore
	log    log.Logger
	tracer trace.Tracer
}

// NewLegacyUserTeamsSearchClient creates a new LegacyUserTeamsSearchClient.
func NewLegacyUserTeamsSearchClient(store legacy.LegacyIdentityStore, tracer trace.Tracer) *LegacyUserTeamsSearchClient {
	return &LegacyUserTeamsSearchClient{
		store:  store,
		log:    log.New("grafana-apiserver.teams.legacy-members-search"),
		tracer: tracer,
	}
}

// Search resolves a `members=<userUID>` filter on the Team resource against
// the legacy team_member table.
//
// Pagination uses the same keyset cursor as the unified-search path: callers
// pass SearchAfter=[lastSeenTeamUID], we order results by team UID ascending,
// and emit SortFields=[item.UID] on each row so the caller can build the next
// continue token. Offset/Page on the request are ignored.
func (c *LegacyUserTeamsSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "team.legacy-members-search")
	defer span.End()

	logger := c.log.FromContext(ctx)

	if req.Limit > common.MaxListLimit {
		return nil, fmt.Errorf("limit cannot be greater than %d", common.MaxListLimit)
	}
	if req.Limit < 1 {
		req.Limit = common.DefaultListLimit
	}

	userUID := userUIDFilter(req)
	empty := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{Columns: teamMembersResultColumns}}
	if userUID == "" {
		// No supported filter — return empty so the caller can fall back.
		logger.Debug("no members=<userUID> filter; returning empty result")
		return empty, nil
	}

	// Subresource ctx has no NamespaceInfo set; the calling handler always
	// fills Options.Key.Namespace, so use that as the source of truth.
	if req.Options == nil || req.Options.Key == nil || req.Options.Key.Namespace == "" {
		return nil, errors.New("missing namespace in search request")
	}
	ns, err := claims.ParseNamespace(req.Options.Key.Namespace)
	if err != nil {
		return nil, err
	}

	// Walk the legacy id-keyed cursor to gather every team this user is in,
	// then re-sort by UID so the keyset cursor we expose externally is
	// consistent with the unified-search path.
	//
	// Cost: O(N) per page request, where N is the user's actual membership
	// count — *not* the requested page size. MaxListLimit only caps req.Limit;
	// it does not bound how many teams a user can belong to. For typical users
	// N is small, but power users (admins, service accounts) can have many
	// memberships and pay the full walk on every page.
	// TODO: switch to a UID-ordered SQL query with `WHERE uid > searchAfter`
	// if this endpoint shows up as a hot path or if N grows beyond a few
	// hundred for representative users.
	const pageSize = 500
	var items []legacy.UserTeam
	var continueToken int64
	for {
		p, err := c.store.ListUserTeams(ctx, ns, legacy.ListUserTeamsQuery{
			UserUID:    userUID,
			Pagination: common.Pagination{Limit: pageSize, Continue: continueToken},
		})
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "list user teams failed")
			logger.Error("failed to list user teams", "user", userUID, "error", err)
			return nil, fmt.Errorf("list user teams: %w", err)
		}
		items = append(items, p.Items...)
		if p.Continue == 0 {
			break
		}
		continueToken = p.Continue
	}
	sort.Slice(items, func(i, j int) bool { return items[i].UID < items[j].UID })

	// SearchAfter contains the last team UID returned on the previous page;
	// skip everything up to and including it.
	if len(req.SearchAfter) > 0 {
		after := req.SearchAfter[0]
		idx := sort.Search(len(items), func(i int) bool { return items[i].UID > after })
		items = items[idx:]
	}

	limit := int(req.Limit)
	if len(items) > limit {
		items = items[:limit]
	}

	logger.Debug("legacy user-teams search resolved",
		"user", userUID,
		"namespace", ns.Value,
		"limit", limit,
		"search_after", req.SearchAfter,
		"returned", len(items),
	)

	// SortFields contract: SortFields[0] is the team's metadata.name (== UID).
	// The unified-search path sorts by SEARCH_FIELD_NAME (also metadata.name)
	// and emits the same value, so continue tokens minted in either mode are
	// portable across legacy/unified — important during dual-writer cutovers.
	rows := make([]*resourcepb.ResourceTableRow, 0, len(items))
	for _, item := range items {
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key: &resourcepb.ResourceKey{
				Namespace: req.Options.Key.Namespace,
				Group:     TeamResourceGroup,
				Resource:  TeamResource,
				Name:      item.UID,
			},
			Cells: [][]byte{
				[]byte(common.MapTeamPermission(item.Permission)),
				[]byte(strconv.FormatBool(item.External)),
			},
			SortFields: []string{item.UID},
		})
	}
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: teamMembersResultColumns,
			Rows:    rows,
		},
	}, nil
}

// userUIDFilter extracts the value of the members=<userUID> field selector
// from the search request, returning "" if not set.
func userUIDFilter(req *resourcepb.ResourceSearchRequest) string {
	if req == nil || req.Options == nil {
		return ""
	}
	key := resource.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_MEMBERS
	for _, r := range req.Options.Fields {
		if r != nil && r.Key == key && len(r.Values) > 0 {
			return r.Values[0]
		}
	}
	return ""
}

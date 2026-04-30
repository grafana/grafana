package team

import (
	"context"
	"errors"
	"fmt"
	"math"
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
	if req.Page > math.MaxInt32 || req.Page < 0 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
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

	limit := int(req.Limit)
	offset := int(req.Offset)
	if req.Page > 1 {
		offset = (int(req.Page) - 1) * limit
	}

	// legacy.ListUserTeams paginates via a `Continue` cursor (id >= last+1),
	// not an offset, so we can't ask SQL for the requested page directly.
	// Walk the cursor, stopping as soon as we have enough rows to satisfy
	// the requested window, then slice in memory.
	want := offset + limit
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
		if p.Continue == 0 || len(items) >= want {
			break
		}
		continueToken = p.Continue
	}

	start := min(offset, len(items))
	end := min(start+limit, len(items))
	window := items[start:end]
	logger.Debug("legacy user-teams search resolved",
		"user", userUID,
		"namespace", ns.Value,
		"limit", limit,
		"offset", offset,
		"page", req.Page,
		"fetched", len(items),
		"returned", len(window),
	)

	rows := make([]*resourcepb.ResourceTableRow, 0, len(window))
	for _, item := range window {
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

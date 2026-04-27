package team

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacysort"
	"github.com/grafana/grafana/pkg/services/team"
	teamsortopts "github.com/grafana/grafana/pkg/services/team/sortopts"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

const (
	TeamResource      = "teams"
	TeamResourceGroup = "iam.grafana.app"
)

// Column names emitted by the member-filtered search branch. The user-teams
// REST handler reads these cells inline so it doesn't need a follow-up Team Get.
const (
	teamMembersColPermission = "permission"
	teamMembersColExternal   = "external"
)

var teamMembersResultColumns = []*resourcepb.ResourceTableColumnDefinition{
	{Name: teamMembersColPermission, Type: resourcepb.ResourceTableColumnDefinition_STRING},
	{Name: teamMembersColExternal, Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN},
}

// TeamSortFieldMapping returns a mapping of unified search field names to legacy SQL sort key names.
// Used by both ConvertToSortOptions (unified→legacy) and ConvertToSortParams (legacy→unified).
func TeamSortFieldMapping() map[string]string {
	return map[string]string{
		resource.SEARCH_FIELD_TITLE: "name",
		fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.TEAM_SEARCH_EMAIL): "email",
	}
}

// LegacyTeamSearchClient is the legacy adapter for Team-resource searches.
//
// It serves two flavors of search and dispatches on the request's field
// filters:
//
//   - members=<userUID>: returns the teams the given user belongs to, with
//     the user's permission and external flag emitted as inline cells. Backed
//     by legacy.ListUserTeams; column shape is teamMembersResultColumns.
//   - everything else: returns teams matched by title / uid / legacy id,
//     backed by team.Service.SearchTeams; columns follow the requested
//     fields plus the standard name/title defaults.
//
// Callers must know which shape they asked for — the column set differs
// between the two branches.
type LegacyTeamSearchClient struct {
	resourcepb.ResourceIndexClient
	teamService team.Service
	store       legacy.LegacyIdentityStore
	log         log.Logger
	tracer      trace.Tracer
}

// NewLegacyTeamSearchClient creates a new LegacyTeamSearchClient.
func NewLegacyTeamSearchClient(teamService team.Service, store legacy.LegacyIdentityStore, tracer trace.Tracer) *LegacyTeamSearchClient {
	return &LegacyTeamSearchClient{
		teamService: teamService,
		store:       store,
		log:         log.New("grafana-apiserver.teams.legacy-search"),
		tracer:      tracer,
	}
}

// Search searches for teams in the legacy backend. See the type doc for the
// dispatch rules between the general and member-filtered branches.
func (c *LegacyTeamSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "team.legacysearch")
	defer span.End()

	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Limit > common.MaxListLimit {
		return nil, fmt.Errorf("limit cannot be greater than %d", common.MaxListLimit)
	}
	if req.Limit < 1 {
		req.Limit = common.DefaultListLimit
	}

	if req.Page > math.MaxInt32 || req.Page < 0 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	if userUID := userUIDFilter(req); userUID != "" {
		return c.searchByMember(ctx, req, signedInUser, userUID)
	}

	title, err := titleFromRequirements(req.Options)
	if err != nil {
		return nil, err
	}

	uids := valuesFromRequirements(req.Options, resource.SEARCH_FIELD_NAME)
	teamIds, err := legacyIDsFromRequirements(req.Options)
	if err != nil {
		return nil, err
	}

	query := &team.SearchTeamsQuery{
		SignedInUser: signedInUser,
		Limit:        int(req.Limit),
		Page:         int(req.Page),
		Query:        req.Query,
		Name:         title,
		UIDs:         uids,
		TeamIds:      teamIds,
		OrgID:        signedInUser.GetOrgID(),
		SortOpts:     legacysort.ConvertToSortOptions(req.SortBy, TeamSortFieldMapping(), teamsortopts.SortOptionsByQueryParam),
	}

	res, err := c.teamService.SearchTeams(ctx, query)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "team legacy search failed")
		return nil, err
	}

	columns := getColumns(req.Fields)
	list := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: columns,
		},
	}

	namespace := signedInUser.GetNamespace()

	for _, t := range res.Teams {
		cells := createCells(t, req.Fields)
		list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
			Key:   getResourceKey(t, namespace),
			Cells: cells,
		})
	}

	list.TotalHits = res.TotalCount

	return list, nil
}

// searchByMember resolves a `members=<userUID>` filter on the Team resource
// against the legacy team_member table. Rows carry the user's permission and
// external flag inline as cells so the user-teams handler doesn't need a
// follow-up Team Get.
func (c *LegacyTeamSearchClient) searchByMember(ctx context.Context, req *resourcepb.ResourceSearchRequest, signedInUser identity.Requester, userUID string) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "team.legacy-members-search")
	defer span.End()

	logger := c.log.FromContext(ctx)

	if c.store == nil {
		return nil, errors.New("legacy identity store not configured")
	}

	ns := claims.NamespaceInfo{
		Value: signedInUser.GetNamespace(),
		OrgID: signedInUser.GetOrgID(),
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
				Namespace: ns.Value,
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

func getResourceKey(t *team.TeamDTO, namespace string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     TeamResourceGroup,
		Resource:  TeamResource,
		Name:      t.UID,
	}
}

func getColumns(fields []string) []*resourcepb.ResourceTableColumnDefinition {
	columns := getDefaultColumns()

	for _, field := range fields {
		fieldName := strings.TrimPrefix(field, resource.SEARCH_FIELD_PREFIX)
		if col, ok := builders.TeamSearchTableColumnDefinitions[fieldName]; ok {
			columns = append(columns, col)
		}
	}

	return columns
}

func getDefaultColumns() []*resourcepb.ResourceTableColumnDefinition {
	searchFields := resource.StandardSearchFields()
	return []*resourcepb.ResourceTableColumnDefinition{
		searchFields.Field(resource.SEARCH_FIELD_NAME),
		searchFields.Field(resource.SEARCH_FIELD_TITLE),
	}
}

func createCells(t *team.TeamDTO, fields []string) [][]byte {
	cells := createDefaultCells(t)
	for _, field := range fields {
		fieldName := strings.TrimPrefix(field, resource.SEARCH_FIELD_PREFIX)
		switch fieldName {
		case builders.TEAM_SEARCH_EMAIL:
			cells = append(cells, []byte(t.Email))
		case builders.TEAM_SEARCH_PROVISIONED:
			cells = append(cells, []byte(strconv.FormatBool(t.IsProvisioned)))
		case builders.TEAM_SEARCH_EXTERNAL_UID:
			cells = append(cells, []byte(t.ExternalUID))
		}
	}
	return cells
}

func createDefaultCells(t *team.TeamDTO) [][]byte {
	return [][]byte{
		[]byte(t.UID),
		[]byte(t.Name),
	}
}

func titleFromRequirements(opts *resourcepb.ListOptions) (string, error) {
	if opts == nil {
		return "", nil
	}
	for _, r := range opts.Fields {
		if r != nil && r.Key == resource.SEARCH_FIELD_TITLE {
			if len(r.Values) != 1 {
				return "", fmt.Errorf("title filter requires exactly one value, got %d", len(r.Values))
			}
			return r.Values[0], nil
		}
	}
	return "", nil
}

func valuesFromRequirements(opts *resourcepb.ListOptions, key string) []string {
	if opts == nil {
		return nil
	}
	for _, r := range opts.Fields {
		if r != nil && r.Key == key && len(r.Values) > 0 {
			return r.Values
		}
	}
	return nil
}

func valuesFromLabels(opts *resourcepb.ListOptions, key string) []string {
	if opts == nil {
		return nil
	}
	for _, r := range opts.Labels {
		if r != nil && r.Key == key && len(r.Values) > 0 {
			return r.Values
		}
	}
	return nil
}

func legacyIDsFromRequirements(opts *resourcepb.ListOptions) ([]int64, error) {
	values := valuesFromLabels(opts, resource.SEARCH_FIELD_LEGACY_ID)
	if len(values) == 0 {
		return nil, nil
	}
	ids := make([]int64, 0, len(values))
	for _, v := range values {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid legacy team ID %q: %w", v, err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

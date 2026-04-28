package team

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
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

// TeamSortFieldMapping returns a mapping of unified search field names to legacy SQL sort key names.
// Used by both ConvertToSortOptions (unified→legacy) and ConvertToSortParams (legacy→unified).
func TeamSortFieldMapping() map[string]string {
	return map[string]string{
		resource.SEARCH_FIELD_TITLE: "name",
		fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.TEAM_SEARCH_EMAIL): "email",
	}
}

// LegacyTeamSearchClient is a client for searching for teams in the legacy search engine.
type LegacyTeamSearchClient struct {
	resourcepb.ResourceIndexClient
	teamService team.Service
	log         log.Logger
	tracer      trace.Tracer
}

// NewLegacyTeamSearchClient creates a new LegacyTeamSearchClient.
func NewLegacyTeamSearchClient(teamService team.Service, tracer trace.Tracer) *LegacyTeamSearchClient {
	return &LegacyTeamSearchClient{
		teamService: teamService,
		log:         log.New("grafana-apiserver.teams.legacy-search"),
		tracer:      tracer,
	}
}

// Search searches for teams in the legacy search engine.
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

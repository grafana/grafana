package team

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/team"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

const (
	TeamResource      = "teams"
	TeamResourceGroup = "iam.grafana.com"
)

// LegacyTeamSearchClient is a client for searching for teams in the legacy search engine.
type LegacyTeamSearchClient struct {
	resourcepb.ResourceIndexClient
	teamService team.Service
	log         *slog.Logger
}

// NewLegacyTeamSearchClient creates a new LegacyTeamSearchClient.
func NewLegacyTeamSearchClient(teamService team.Service) *LegacyTeamSearchClient {
	return &LegacyTeamSearchClient{
		teamService: teamService,
		log:         slog.Default().With("logger", "legacy-team-search-client"),
	}
}

// Search searches for teams in the legacy search engine.
func (c *LegacyTeamSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Limit > 100 {
		req.Limit = 100
	}
	if req.Limit <= 0 {
		req.Limit = 1
	}

	if req.Page > math.MaxInt32 || req.Page < 0 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	query := &team.SearchTeamsQuery{
		SignedInUser: signedInUser,
		Limit:        int(req.Limit),
		Page:         int(req.Page),
		Query:        req.Query,
		OrgID:        signedInUser.GetOrgID(),
	}

	res, err := c.teamService.SearchTeams(ctx, query)
	if err != nil {
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
		cells := createDefaultCells(t)
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
	columns := defaultColumns()
	for _, field := range fields {
		switch field {
		case res.SEARCH_FIELD_TITLE:
			columns = append(columns, search.TableColumnDefinitions[res.SEARCH_FIELD_TITLE])
		}
	}
	return columns
}

func defaultColumns() []*resourcepb.ResourceTableColumnDefinition {
	searchFields := res.StandardSearchFields()
	return []*resourcepb.ResourceTableColumnDefinition{
		searchFields.Field(res.SEARCH_FIELD_NAME),
		searchFields.Field(res.SEARCH_FIELD_TITLE),
		searchFields.Field("email"),
		searchFields.Field("provisioned"),
		searchFields.Field("externalUID"),
	}
}

func createDefaultCells(t *team.TeamDTO) [][]byte {
	return [][]byte{
		[]byte(t.UID),
		[]byte(t.Name),
		[]byte(t.Email),
		[]byte(strconv.FormatBool(t.IsProvisioned)),
		[]byte(t.ExternalUID),
	}
}

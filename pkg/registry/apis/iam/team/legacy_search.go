package team

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strconv"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/team"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
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
		cells := createCells(c.log, t, req.Fields)
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
		if col, ok := builders.TeamSearchTableColumnDefinitions[field]; ok {
			columns = append(columns, col)
		}
	}

	return columns
}

func getDefaultColumns() []*resourcepb.ResourceTableColumnDefinition {
	searchFields := res.StandardSearchFields()
	return []*resourcepb.ResourceTableColumnDefinition{
		searchFields.Field(res.SEARCH_FIELD_NAME),
		searchFields.Field(res.SEARCH_FIELD_TITLE),
	}
}

func createCells(log *slog.Logger, t *team.TeamDTO, fields []string) [][]byte {
	cells := createDefaultCells(t)
	for _, field := range fields {
		switch field {
		case builders.TEAM_SEARCH_EMAIL:
			cells = append(cells, []byte(t.Email))
		case builders.TEAM_SEARCH_PROVISIONED:
			cells = append(cells, []byte(strconv.FormatBool(t.IsProvisioned)))
		case builders.TEAM_SEARCH_EXTERNAL_UID:
			cells = append(cells, []byte(t.ExternalUID))
		case builders.TEAM_SEARCH_MEMBER_COUNT:
			b := make([]byte, 8)
			binary.BigEndian.PutUint64(b, uint64(t.MemberCount))
			cells = append(cells, b)
		case builders.TEAM_SEARCH_PERMISSION:
			b := make([]byte, 4)
			binary.BigEndian.PutUint32(b, uint32(t.Permission))
			cells = append(cells, b)
		case builders.TEAM_SEARCH_ACCESS_CONTROL:
			accessControl, err := json.Marshal(t.AccessControl)
			if err != nil {
				log.Error("error marshalling access control", "error", err)
				cells = append(cells, []byte(""))
				continue
			}
			cells = append(cells, accessControl)
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

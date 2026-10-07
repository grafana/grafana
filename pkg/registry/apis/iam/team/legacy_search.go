package team

import (
	"cmp"
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/team"
	teamsortopts "github.com/grafana/grafana/pkg/services/team/sortopts"
)

const (
	TeamResource      = "teams"
	TeamResourceGroup = "iam.grafana.app"
)

// TeamSortFieldMapping maps team-search sort fields to legacy SQL sort keys.
func TeamSortFieldMapping() map[string]string {
	return map[string]string{
		"title": "name",
		"email": "email",
	}
}

var _ SearchBackend = (*legacySearchClient)(nil)

type legacySearchClient struct {
	teamService team.Service
	tracer      trace.Tracer
}

func NewLegacyTeamSearchClient(teamService team.Service, tracer trace.Tracer) *legacySearchClient {
	return &legacySearchClient{teamService: teamService, tracer: tracer}
}

func (c *legacySearchClient) Search(ctx context.Context, req SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
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

	var teamIDs []int64
	for _, value := range req.TeamIDs {
		id, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid legacy team ID %q: %w", value, err)
		}
		teamIDs = append(teamIDs, id)
	}

	query := &team.SearchTeamsQuery{
		SignedInUser: signedInUser,
		Limit:        int(req.Limit),
		Page:         int(req.Page),
		Query:        req.Query,
		Name:         req.Title,
		UIDs:         req.UIDs,
		TeamIds:      teamIDs,
		OrgID:        signedInUser.GetOrgID(),
		SortOpts:     legacyTeamSortOptions(req.Sort),
	}

	res, err := c.teamService.SearchTeams(ctx, query)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "team legacy search failed")
		return nil, err
	}

	result := &iamv0.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0.GetSearchTeamsBody{
		Offset:    req.Offset,
		TotalHits: res.TotalCount,
		Hits:      make([]iamv0.GetSearchTeamsTeamHit, 0, len(res.Teams)),
	}}
	for _, t := range res.Teams {
		result.Hits = append(result.Hits, iamv0.GetSearchTeamsTeamHit{
			Name:        t.UID,
			Title:       t.Name,
			Email:       t.Email,
			Provisioned: t.IsProvisioned,
			ExternalUID: t.ExternalUID,
			InternalId:  &t.ID,
		})
	}
	return result, nil
}

func legacyTeamSortOptions(sortBy []string) []model.SortOption {
	mapping := TeamSortFieldMapping()
	opts := []model.SortOption{}
	for _, field := range sortBy {
		direction := "asc"
		if strings.HasPrefix(field, "-") {
			field = field[1:]
			direction = "desc"
		}
		field = strings.TrimPrefix(field, "fields.")
		if mapped, ok := mapping[field]; ok {
			field = mapped
		}
		if opt, ok := teamsortopts.SortOptionsByQueryParam[field+"-"+direction]; ok {
			opts = append(opts, opt)
		}
	}
	slices.SortFunc(opts, func(a, b model.SortOption) int {
		if order := cmp.Compare(a.Index, b.Index); order != 0 {
			return order
		}
		return cmp.Compare(a.Name, b.Name)
	})
	return opts
}

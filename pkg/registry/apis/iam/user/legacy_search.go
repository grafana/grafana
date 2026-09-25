package user

import (
	"cmp"
	"context"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ SearchBackend = (*legacySearchClient)(nil)

var wildcardsMatcher = regexp.MustCompile(`[\*\?\\]`)

type legacySearchClient struct {
	orgService org.Service
	tracer     trace.Tracer
	cfg        *setting.Cfg
}

func NewUserLegacySearchClient(orgService org.Service, tracer trace.Tracer, cfg *setting.Cfg) *legacySearchClient {
	return &legacySearchClient{
		orgService: orgService,
		tracer:     tracer,
		cfg:        cfg,
	}
}

func (c *legacySearchClient) Search(ctx context.Context, req SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
	ctx, span := c.tracer.Start(ctx, "user.legacysearch")
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
	if req.Page < 1 {
		req.Page = 1
	}

	query := &org.SearchOrgUsersQuery{
		OrgID:    signedInUser.GetOrgID(),
		Limit:    int(req.Limit),
		Page:     int(req.Page),
		SortOpts: legacyUserSortOptions(req.Sort),
		User:     signedInUser,
	}
	if req.Email != nil {
		query.Query = *req.Email
	}
	if req.Login != nil && *req.Login != "" {
		query.Query = *req.Login
	}
	if req.Query != "" {
		// Preserve legacy matching, which ignores these characters in free-text queries.
		query.Query = wildcardsMatcher.ReplaceAllString(req.Query, "")
	}

	res, err := c.orgService.SearchOrgUsers(ctx, query)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "user legacy search failed")
		return nil, err
	}

	result := iamv0.NewGetSearchUsersResponse()
	result.TotalHits = res.TotalCount
	result.Hits = make([]iamv0.GetSearchUsersUserHit, 0, len(res.OrgUsers))
	for _, u := range res.OrgUsers {
		if c.isHiddenUser(u.Login, signedInUser) {
			continue
		}
		result.Hits = append(result.Hits, iamv0.GetSearchUsersUserHit{
			Name:          u.UID,
			Title:         u.Name,
			Email:         u.Email,
			Login:         u.Login,
			Role:          u.Role,
			LastSeenAt:    u.LastSeenAt.Unix(),
			LastSeenAtAge: util.GetAgeString(u.LastSeenAt),
			Disabled:      u.IsDisabled,
			InternalId:    u.UserID,
			Created:       u.Created.UnixMilli(),
		})
	}
	return result, nil
}

func (c *legacySearchClient) isHiddenUser(login string, signedInUser identity.Requester) bool {
	if login == "" || signedInUser.GetIsGrafanaAdmin() || login == signedInUser.GetUsername() {
		return false
	}
	_, hidden := c.cfg.HiddenUsers[login]
	return hidden
}

// UserSortFieldMapping maps user-search sort fields to legacy SQL sort keys.
func UserSortFieldMapping() map[string]string {
	return map[string]string{
		"lastSeenAt": "lastSeenAtAge",
		"title":      "name",
		"login":      "login",
		"email":      "email",
	}
}

func legacyUserSortOptions(sortBy []string) []model.SortOption {
	mapping := UserSortFieldMapping()
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
		if opt, ok := sortopts.SortOptionsByQueryParam[field+"-"+direction]; ok {
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

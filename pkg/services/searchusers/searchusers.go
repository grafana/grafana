package searchusers

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service interface {
	SearchUsers(c *contextmodel.ReqContext) response.Response
	SearchUsersWithPaging(c *contextmodel.ReqContext) response.Response
}

type OSSService struct {
	settingsProvider setting.SettingsProvider
	searchUserFilter user.SearchUserFilter
	userService      user.Service
}

func ProvideUsersService(settingsProvider setting.SettingsProvider, searchUserFilter user.SearchUserFilter, userService user.Service,
) *OSSService {
	return &OSSService{
		settingsProvider: settingsProvider,
		searchUserFilter: searchUserFilter,
		userService:      userService,
	}
}

// swagger:route GET /users users searchUsers
//
// Get users.
//
// Returns all users that the authenticated user has permission to view, admin permission required.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *OSSService) SearchUsers(c *contextmodel.ReqContext) response.Response {
	result, err := s.SearchUser(c)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to fetch users", err)
	}

	return response.JSON(http.StatusOK, result.Users)
}

// swagger:route GET /users/search users searchUsersWithPaging
//
// Get users with paging.
//
// Responses:
// 200: searchUsersWithPagingResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *OSSService) SearchUsersWithPaging(c *contextmodel.ReqContext) response.Response {
	result, err := s.SearchUser(c)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to fetch users", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (s *OSSService) SearchUser(c *contextmodel.ReqContext) (*user.SearchUserQueryResult, error) {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	searchQuery := c.Query("query")
	filters := []user.Filter{}
	for filterName := range s.searchUserFilter.GetFilterList() {
		filter := s.searchUserFilter.GetFilter(filterName, c.QueryStrings(filterName))
		if filter != nil {
			filters = append(filters, filter)
		}
	}

	sortOpts, err := sortopts.ParseSortQueryParam(c.Query("sort"))
	if err != nil {
		return nil, err
	}

	query := &user.SearchUsersQuery{
		// added SignedInUser to the query, as to only list the users that the user has permission to read
		SignedInUser: c.SignedInUser,
		Query:        searchQuery,
		Filters:      filters,
		Page:         page,
		Limit:        perPage,
		SortOpts:     sortOpts,
	}
	res, err := s.userService.Search(c.Req.Context(), query)
	if err != nil {
		return nil, err
	}

	for _, user := range res.Users {
		user.AvatarURL = dtos.GetGravatarUrl(s.settingsProvider, user.Email)
		user.AuthLabels = make([]string, 0, len(user.AuthModule))
		for _, authModule := range user.AuthModule {
			user.AuthLabels = append(user.AuthLabels, login.GetAuthProviderLabel(authModule))
		}
	}

	res.Page = page
	res.PerPage = perPage

	return res, nil
}

// swagger:response searchUsersResponse
type SearchUsersResponse struct {
	// The response message
	// in: body
	Body []*user.UserSearchHitDTO `json:"body"`
}

// swagger:response searchUsersWithPagingResponse
type SearchUsersWithPagingResponse struct {
	// The response message
	// in: body
	Body *user.SearchUserQueryResult `json:"body"`
}

package searchusers

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Service interface {
	SearchUsers(c *models.ReqContext) response.Response
	SearchUsersWithPaging(c *models.ReqContext) response.Response
}

type OSSService struct {
	sqlStore         sqlstore.Store
	searchUserFilter models.SearchUserFilter
}

func ProvideUsersService(sqlStore sqlstore.Store, searchUserFilter models.SearchUserFilter) *OSSService {
	return &OSSService{sqlStore: sqlStore, searchUserFilter: searchUserFilter}
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
func (s *OSSService) SearchUsers(c *models.ReqContext) response.Response {
	query, err := s.SearchUser(c)
	if err != nil {
		return response.Error(500, "Failed to fetch users", err)
	}

	return response.JSON(http.StatusOK, query.Result.Users)
}

// swagger:route GET /users/search users searchUsersWithPaging
//
// Get users with paging.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *OSSService) SearchUsersWithPaging(c *models.ReqContext) response.Response {
	query, err := s.SearchUser(c)
	if err != nil {
		return response.Error(500, "Failed to fetch users", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

func (s *OSSService) SearchUser(c *models.ReqContext) (*models.SearchUsersQuery, error) {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	searchQuery := c.Query("query")
	filters := make([]models.Filter, 0)
	for filterName := range s.searchUserFilter.GetFilterList() {
		filter := s.searchUserFilter.GetFilter(filterName, c.QueryStrings(filterName))
		if filter != nil {
			filters = append(filters, filter)
		}
	}

	query := &models.SearchUsersQuery{
		// added SignedInUser to the query, as to only list the users that the user has permission to read
		SignedInUser: c.SignedInUser,
		Query:        searchQuery,
		Filters:      filters,
		Page:         page,
		Limit:        perPage,
	}
	if err := s.sqlStore.SearchUsers(c.Req.Context(), query); err != nil {
		return nil, err
	}

	for _, user := range query.Result.Users {
		user.AvatarUrl = dtos.GetGravatarUrl(user.Email)
		user.AuthLabels = make([]string, 0)
		if user.AuthModule != nil && len(user.AuthModule) > 0 {
			for _, authModule := range user.AuthModule {
				user.AuthLabels = append(user.AuthLabels, GetAuthProviderLabel(authModule))
			}
		}
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return query, nil
}

func GetAuthProviderLabel(authModule string) string {
	switch authModule {
	case "oauth_github":
		return "GitHub"
	case "oauth_google":
		return "Google"
	case "oauth_azuread":
		return "AzureAD"
	case "oauth_gitlab":
		return "GitLab"
	case "oauth_grafana_com", "oauth_grafananet":
		return "grafana.com"
	case "auth.saml":
		return "SAML"
	case "ldap", "":
		return "LDAP"
	case "jwt":
		return "JWT"
	default:
		return "OAuth"
	}
}

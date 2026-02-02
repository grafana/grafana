package msp

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"

	"github.com/grafana/grafana/pkg/api/response"
)

func (s *Service) GetSignedInUserMSPTeamList(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}
	mspOrgsIdsList := make([]int64, 0)

	// if err := web.Bind(c.Req, &c.SignedInUser.MspOrgs); err != nil {
	// 	return response.Error(http.StatusBadRequest, "Bad request data", err)
	// }

	resultTeams := team.SearchTeamQueryResult{
		Teams: make([]*team.TeamDTO, 0),
	}
	teams := make([]*team.TeamDTO, 0)
	var err error
	if c.SignedInUser.OrgRole == "Admin" || c.SignedInUser.IsUnrestrictedUser {
		//Get All MSP Teams
		searchQuery := team.SearchTeamsQuery{
			SignedInUser: c.SignedInUser,
			OrgID:        c.OrgID,
			IsMSPTeams:   true,
			Page:         page,
			Limit:        perPage,
		}
		searchResult, err := s.teamService.SearchTeams(c.Req.Context(), &searchQuery)
		if err != nil {
			c.Logger.Error("Failed to fetch msp teams")
		} else {
			teams = searchResult.Teams
			resultTeams.TotalCount = searchResult.TotalCount
		}
	} else {
		//Get only MSP teams to which user belongs
		for _, mspOrgId := range c.SignedInUser.MspOrgs {
			if mspOrgId != "0" {
				mspTeamID := CreateTeamIDWithOrgString(c.SignedInUser.OrgID, mspOrgId)
				mspOrgsIdsList = append(mspOrgsIdsList, int64(mspTeamID))
			}
		}
		teams, err = s.teamService.GetTeamsByIds(c.Req.Context(), c.SignedInUser.OrgID, mspOrgsIdsList)
		if err != nil {
			c.Logger.Error("Failed to fetch msp teams")
		}
		resultTeams.TotalCount = int64(len(teams))
	}
	resultTeams.Teams = teams
	resultTeams.Page = page
	resultTeams.PerPage = perPage
	return response.JSON(http.StatusOK, resultTeams)
}

func (s *Service) SearchTeams(c *contextmodel.ReqContext) response.Response {
	// Todo: may change if we have more than one msp org associated with a user
	// By then we will have to change the logic to get all the msp users associated with the msp org id
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}
	// ToDo_GF_10.4.2: UserIDFilter removed, and check on accessControl.IsDisabled removed too
	// Since accesscontrol is enabled by default.
	// Using accesscontrol the filtering is done based on user permissions
	// userIdFilter := team.FilterIgnoreUser
	// if !c.IsUnrestrictedUser {
	// 	userIdFilter = userFilter(c)
	// }

	query := &team.SearchTeamsQuery{
		OrgID: c.OrgID,
		Query: c.Query("query"),
		Name:  c.Query("name"),
		// UserIDFilter: userIdFilter,
		Page:         page,
		Limit:        perPage,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  s.Cfg.HiddenUsers,
	}

	resultTeams, err := s.teamService.SearchTeams(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to search Teams", err)
	}

	teamList := make([]*team.TeamDTO, 0)
	teamIDs := GetMspOrgIdsFromCtx(c)
	for _, team := range resultTeams.Teams {
		if Includes(team.ID, teamIDs) || c.IsUnrestrictedUser {
			team.AvatarURL = dtos.GetGravatarUrlWithDefault(&s.Cfg, team.Email, team.Name)
			teamList = append(teamList, team)
		}
	}

	teamListIDs := map[string]bool{}
	for _, team := range resultTeams.Teams {
		team.AvatarURL = dtos.GetGravatarUrlWithDefault(&s.Cfg, team.Email, team.Name)
		teamListIDs[strconv.FormatInt(team.ID, 10)] = true
	}

	metadata := s.getMultiAccessControlMetadata(c, c.OrgID, "teams:id:", teamListIDs)
	if len(metadata) > 0 {
		for _, team := range resultTeams.Teams {
			team.AccessControl = metadata[strconv.FormatInt(team.ID, 10)]
		}
	}

	resultTeams.Teams = teamList
	resultTeams.Page = page
	resultTeams.PerPage = perPage

	return response.JSON(http.StatusOK, resultTeams)

}

// UserFilter returns the user ID used in a filter when querying a team
// 1. If the user is a viewer or editor, this will return the user's ID.
// 2. If the user is an admin, this will return models.FilterIgnoreUser (0)
// func userFilter(c *contextmodel.ReqContext) int64 {
// 	userIdFilter := c.SignedInUser.UserID
// 	if c.OrgRole == org.RoleAdmin {
// 		userIdFilter = team.FilterIgnoreUser
// 	}
// 	return userIdFilter
// }

// getMultiAccessControlMetadata returns the accesscontrol metadata associated with a given set of resources
// Context must contain permissions in the given org (see LoadPermissionsMiddleware or AuthorizeInOrgMiddleware)
func (s *Service) getMultiAccessControlMetadata(c *contextmodel.ReqContext,
	orgID int64, prefix string, resourceIDs map[string]bool) map[string]ac.Metadata {
	if !c.QueryBool("accesscontrol") {
		return map[string]ac.Metadata{}
	}

	if c.SignedInUser.Permissions == nil {
		return map[string]ac.Metadata{}
	}

	permissions, ok := c.SignedInUser.Permissions[orgID]
	if !ok {
		return map[string]ac.Metadata{}
	}

	return ac.GetResourcesMetadata(c.Req.Context(), permissions, prefix, resourceIDs)
}

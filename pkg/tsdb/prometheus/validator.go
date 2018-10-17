package prometheus

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/prometheus/prometheus/promql"
)

// QueryValidator offers validation of a prometheus query, according to the
// configured user permissions
type QueryValidator struct {
	query                promql.Expr
	permissionLabel      string
	permissionLabelValue string
	orgID                int64
	userID               int64
	teams                []*models.TeamDTO
	isAdmin              bool
}

// NewQueryValidator returns a new QueryValidator for the given query, or error
// in case of parsing errors
func NewQueryValidator(query string, dsInfo *models.DataSource, orgID int64, userID int64, teams []*models.TeamDTO, isAdmin bool) (QueryValidator, error) {
	// parse promql expression from query
	promExpr, err := promql.ParseExpr(query)
	if err != nil {
		return QueryValidator{}, fmt.Errorf("Failed to parse Prometheus query: %s", err)
	}

	// pick up prometheus security permission settings
	var dsPermissionLabel, dsPermissionLabelValue string
	if dsInfo.JsonData != nil {
		dsPermissionLabel = dsInfo.JsonData.Get("permissionLabel").MustString("")
		dsPermissionLabelValue = dsInfo.JsonData.Get("permissionLabelValue").MustString("")
	}

	// return results as a struct
	validator := QueryValidator{
		query:                promExpr,
		permissionLabel:      dsPermissionLabel,
		permissionLabelValue: dsPermissionLabelValue,
		orgID:                orgID,
		userID:               userID,
		teams:                teams,
		isAdmin:              isAdmin,
	}
	return validator, nil
}

// Visit validates a single node in the query tree
func (visitor *QueryValidator) Visit(node promql.Node, path []promql.Node) (promql.Visitor, error) {
	isFilterValid := false

	switch node.(type) {
	case *promql.VectorSelector:
		selector := node.(*promql.VectorSelector)
		for i := range selector.LabelMatchers {
			matcher := selector.LabelMatchers[i]
			switch visitor.permissionLabelValue {
			case "teamID", "teamName":
				foundAnyTeam := false
				for _, team := range visitor.teams {
					value := ""
					if visitor.permissionLabelValue == "teamID" {
						value = fmt.Sprintf("%d", team.Id)
					} else {
						value = team.Name
					}
					if matcher.Name == visitor.permissionLabel && matcher.Value == value {
						foundAnyTeam = true
						break
					}
				}
				if matcher.Name == visitor.permissionLabel && foundAnyTeam {
					isFilterValid = true
				}
			case "userID":
				userID := fmt.Sprintf("%d", visitor.userID)
				if matcher.Name == visitor.permissionLabel && matcher.Value == userID {
					isFilterValid = true
				}
			case "orgID":
				ordID := fmt.Sprintf("%d", visitor.orgID)
				if matcher.Name == visitor.permissionLabel && matcher.Value == ordID {
					isFilterValid = true
				}
			default:
				return nil, errors.New("Permission label value unknown: please check your data source configuration")
			}

		}
	default:
		// no limiting node, filter okay
		isFilterValid = true
	}

	if !isFilterValid {
		return nil, errors.New("Query could not be validated: selector without filter found - permission denied")
	}

	return visitor, nil
}

// Validate walks through the given query tree and validates the user permissions
func (visitor *QueryValidator) Validate() error {
	if visitor.isAdmin {
		// admin has permission to everything
		return nil
	}

	err := promql.Walk(visitor, visitor.query, []promql.Node{})
	return err
}

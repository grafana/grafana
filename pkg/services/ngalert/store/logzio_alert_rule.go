package store

// LOGZ.IO GRAFANA CHANGE :: DEV-34631 - Refactor query to retrieve visible namespaces for unified alerting rules

import (
	"context"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type LogzioRuleStore struct {
	SQLStore *sqlstore.SQLStore
}

func (st LogzioRuleStore) GetVisibleUserNamespaces(context context.Context, namespaceUid []string, orgId int64, user *models.SignedInUser) (map[string]*models.FolderRef, error) {
	namespaceMap := make(map[string]*models.FolderRef)

	getDashboardsQuery := buildGetDashboardsTitlesQuery(namespaceUid, orgId, user)

	err := st.SQLStore.GetFoldersByUIDs(context, getDashboardsQuery)
	if err != nil {
		return nil, err
	}

	for _, dashboardProj := range getDashboardsQuery.Result {
		namespaceMap[dashboardProj.Uid] = dashboardProj
	}
	return namespaceMap, nil
}

func buildGetDashboardsTitlesQuery(namespaceUid []string, orgId int64, user *models.SignedInUser) *models.GetFoldersByUIDsQuery {
	var orgIdFilter int64
	if orgId == 0 {
		orgIdFilter = user.OrgId
	} else {
		orgIdFilter = orgId
	}

	return &models.GetFoldersByUIDsQuery{
		DashboardUIDs: namespaceUid,
		OrgID:         orgIdFilter,
	}
}

// LOGZ.IO GRAFANA CHANGE :: end

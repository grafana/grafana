package searchV2

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/queries"
	"github.com/grafana/grafana/pkg/services/searchV2/alert_store"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
)

type sqlAlertsLoader struct {
	logger log.Logger
}

func newSqlAlertsLoader() *sqlAlertsLoader {
	return &sqlAlertsLoader{logger: log.New("sqlAlertsLoader")}
}

func (l sqlAlertsLoader) getRuleStore() ngstore.RuleStore {
	return alert_store.RuleStore
}

type alert struct {
	uid          string
	slug         string
	namespaceUID string
	created      time.Time
	updated      time.Time
	info         *extract.AlertInfo
}

func (l sqlAlertsLoader) LoadAlerts(ctx context.Context, orgID int64, uid string, lookup dslookup.DatasourceLookup) ([]alert, error) {
	if uid != "" {
		query := &ngmodels.GetAlertRuleByUIDQuery{
			UID:    uid,
			OrgID:  orgID,
			Result: nil,
		}
		err := l.getRuleStore().GetAlertRuleByUID(ctx, query)
		if query.Result == nil || err != nil {
			return []alert{}, nil
		}

		alertRule := query.Result
		queryRef := make([]queries.SavedQueryLink, 0)
		if alertRule.SavedQueryUID != "" {
			queryRef = append(queryRef, queries.SavedQueryLink{Ref: queries.SavedQueryRef{UID: alertRule.SavedQueryUID}})
		}

		return []alert{
			{
				uid:          alertRule.UID,
				slug:         "TODO-slug",
				created:      alertRule.Updated,
				updated:      alertRule.Updated,
				namespaceUID: alertRule.NamespaceUID,
				info: &extract.AlertInfo{
					UID:           alertRule.UID,
					Title:         alertRule.Title,
					Description:   alertRule.Title,
					Tags:          []string{},
					SchemaVersion: 0,
					SavedQuery:    queryRef,
				},
			},
		}, nil
	}

	alerts := make([]alert, 0)
	query := &ngmodels.ListAlertRulesQuery{OrgID: orgID}
	if err := l.getRuleStore().ListAlertRules(ctx, query); err != nil {
		return nil, err
	}

	if query.Result == nil || len(query.Result) == 0 {
		return []alert{}, nil
	}

	for _, alertRule := range query.Result {
		queryRef := make([]queries.SavedQueryLink, 0)
		if alertRule.SavedQueryUID != "" {
			queryRef = append(queryRef, queries.SavedQueryLink{Ref: queries.SavedQueryRef{UID: alertRule.SavedQueryUID}})
		}
		alerts = append(alerts,
			alert{
				uid:          alertRule.UID,
				slug:         "TODO-slug",
				created:      alertRule.Updated,
				updated:      alertRule.Updated,
				namespaceUID: alertRule.NamespaceUID,
				info: &extract.AlertInfo{
					UID:           alertRule.UID,
					Title:         alertRule.Title,
					Description:   alertRule.Title,
					Tags:          []string{},
					SchemaVersion: 0,
					SavedQuery:    queryRef,
				},
			})
	}

	return alerts, nil
}

package api

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Historian interface {
	Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error)
}

type HistorySrv struct {
	logger log.Logger
	hist   Historian
}

func (srv *HistorySrv) RouteQueryStateHistory(c *contextmodel.ReqContext) response.Response {
	query, err := ParseHistoryQuery(c.OrgID, c.SignedInUser, c.Req.URL.Query())
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	frame, err := srv.hist.Query(c.Req.Context(), query)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, frame)
}

const labelQueryPrefix = "labels_"

// ParseHistoryQuery parses a HistoryQuery from request parameters.
func ParseHistoryQuery(orgID int64, user identity.Requester, query url.Values) (models.HistoryQuery, error) {
	from, _ := strconv.ParseInt(query.Get("from"), 10, 64)
	to, _ := strconv.ParseInt(query.Get("to"), 10, 64)
	limit, _ := strconv.Atoi(query.Get("limit"))
	ruleUID := query.Get("ruleUID")
	dashUID := query.Get("dashboardUID")
	panelID, _ := strconv.ParseInt(query.Get("panelID"), 10, 64)

	previous := query.Get("previous")
	if previous != "" {
		_, err := eval.ParseStateString(previous)
		if err != nil {
			return models.HistoryQuery{}, fmt.Errorf("invalid previous state filter: %w", err)
		}
	}

	current := query.Get("current")
	if current != "" {
		_, err := eval.ParseStateString(current)
		if err != nil {
			return models.HistoryQuery{}, fmt.Errorf("invalid current state filter: %w", err)
		}
	}

	labels := make(map[string]string)
	for k, v := range query {
		if strings.HasPrefix(k, labelQueryPrefix) {
			labels[k[len(labelQueryPrefix):]] = v[0]
		}
	}

	return models.HistoryQuery{
		RuleUID:      ruleUID,
		OrgID:        orgID,
		DashboardUID: dashUID,
		PanelID:      panelID,
		Previous:     previous,
		Current:      current,
		SignedInUser: user,
		From:         time.Unix(from, 0),
		To:           time.Unix(to, 0),
		Limit:        limit,
		Labels:       labels,
	}, nil
}

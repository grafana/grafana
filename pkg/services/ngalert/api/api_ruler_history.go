package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
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

const labelQueryPrefix = "labels_"

func (srv *HistorySrv) RouteQueryStateHistory(c *contextmodel.ReqContext) response.Response {
	from := c.QueryInt64("from")
	to := c.QueryInt64("to")
	limit := c.QueryInt("limit")
	ruleUID := c.Query("ruleUID")
	dashUID := c.Query("dashboardUID")
	panelID := c.QueryInt64("panelID")

	previous := c.Query("previous")
	if previous != "" {
		_, err := eval.ParseStateString(previous)
		if err != nil {
			return ErrResp(http.StatusBadRequest, fmt.Errorf("invalid previous state filter: %w", err), "")
		}
	}

	current := c.Query("current")
	if current != "" {
		_, err := eval.ParseStateString(current)
		if err != nil {
			return ErrResp(http.StatusBadRequest, fmt.Errorf("invalid current state filter: %w", err), "")
		}
	}

	labels := make(map[string]string)
	for k, v := range c.Req.URL.Query() {
		if strings.HasPrefix(k, labelQueryPrefix) {
			labels[k[len(labelQueryPrefix):]] = v[0]
		}
	}

	query := models.HistoryQuery{
		RuleUID:      ruleUID,
		OrgID:        c.GetOrgID(),
		DashboardUID: dashUID,
		PanelID:      panelID,
		Previous:     previous,
		Current:      current,
		SignedInUser: c.SignedInUser,
		From:         time.Unix(from, 0),
		To:           time.Unix(to, 0),
		Limit:        limit,
		Labels:       labels,
	}
	frame, err := srv.hist.Query(c.Req.Context(), query)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, frame)
}

package api

import (
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/prometheus/prometheus/promql/parser"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/promlib/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/stats"
)

type DashboardMetricStats struct {
	MetricStats map[string]int `json:"metric-stats"`
}

func (hs *HTTPServer) GetMetricStats(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetMetricStats")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	dashboardQuery := stats.GetExtractedExpressionsQuery{OrgID: c.SignedInUser.GetOrgID(), DSType: "prometheus"}
	dashboardQueryResult, err := hs.statsService.GetExpressionsFromDashboardPanels(c.Req.Context(), &dashboardQuery)
	if err != nil {
		c.JsonApiErr(500, "failed to get exprs from dashboards", err)
		return response.Err(fmt.Errorf("failed to get exprs from dashboards: %v", err))
	}

	alertRuleQuery := stats.GetExtractedExpressionsQuery{OrgID: c.SignedInUser.GetOrgID(), DSType: "prometheus"}
	alertRuleQueryResult, err := hs.statsService.GetExpressionsFromAlertRules(c.Req.Context(), &alertRuleQuery)
	if err != nil {
		c.JsonApiErr(500, "failed to get exprs from dashboards", err)
		return response.Err(fmt.Errorf("failed to get exprs from dashboards: %v", err))
	}

	metricCount := map[string]map[string]int{
		"alertRules": make(map[string]int),
		"dashboards": make(map[string]int),
	}

	countMetricNames(alertRuleQueryResult, metricCount["alertRules"])
	countMetricNames(dashboardQueryResult, metricCount["dashboards"])

	return response.JSON(http.StatusOK, metricCount)
}

func countMetricNames(queryResult []*stats.ExtractedExpression, metricCount map[string]int) {
	uniqueMetricName := make(map[string]int64)

	// Iterate over each expression and extract metrics
	for _, expression := range queryResult {
		// Just interpolate the grafana built-in variables
		interpolatedExpr := models.InterpolateIntervals(expression.Expr, time.Second, time.Second, 1000, 1)
		metricNames, err := extractMetricName(interpolatedExpr)
		if err != nil {
			fmt.Println(fmt.Sprintf("couldn't extract the metric name: %v", expression.Expr))
			continue
		}
		// Count each metric occurrence only once for each dashboard
		for _, metric := range metricNames {
			if metric != "" {
				if _, processed := uniqueMetricName[metric]; !processed || uniqueMetricName[metric] != expression.ID {
					uniqueMetricName[metric] = expression.ID
					metricCount[metric]++
				}
			}
		}
	}
}

// MetricVisitor is a custom Visitor to collect metric names from a PromQL AST
type MetricVisitor struct {
	metrics []string
}

// Visit is the method that handles the AST nodes and extracts metric names
func (v *MetricVisitor) Visit(node parser.Node, path []parser.Node) (parser.Visitor, error) {
	switch n := node.(type) {
	case *parser.VectorSelector:
		// For a VectorSelector, it's the metric name
		if !slices.Contains(v.metrics, n.Name) {
			v.metrics = append(v.metrics, n.Name)
		}
	}
	// Continue walking the tree
	return v, nil
}

// Function to extract metric names from a PromQL expression
func extractMetricName(expr string) ([]string, error) {
	// Parse the PromQL expression into an AST
	node, err := parser.ParseExpr(expr)
	if err != nil {
		return nil, err
	}

	// Create a visitor and walk the AST
	visitor := &MetricVisitor{}
	err = parser.Walk(visitor, node, nil)
	if err != nil {
		return nil, err
	}

	// Return the collected metric names
	return visitor.metrics, nil
}

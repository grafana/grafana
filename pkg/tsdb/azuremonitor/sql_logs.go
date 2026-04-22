package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func normalizeLogsSQLQuery(ctx context.Context, sq schemas.Query, q backend.DataQuery, dsInfo types.DatasourceInfo, svc *Service) (backend.DataQuery, error) {
	tp := mergeTableParams(sq.Table, sq.TableParameterValues)

	logTable := strParam(tp, logTableParam)
	if logTable == "" {
		return backend.DataQuery{}, fmt.Errorf("azure logs sql: log_table table parameter is required")
	}

	subRaw := strParam(tp, subscription)
	sub := parseSubscriptionIDFromParameter(subRaw)
	if sub == "" {
		return backend.DataQuery{}, fmt.Errorf("azure logs sql: subscription table parameter is required")
	}

	workspaces, err := svc.getWorkspacesForSubscription(ctx, dsInfo, sub)
	if err != nil {
		return backend.DataQuery{}, fmt.Errorf("azure logs sql: %w", err)
	}
	baseTable := stripTableParameterValues(sq.Table)
	ws := resolveWorkspaceFromTableName(baseTable, workspaces)
	if ws == nil {
		return backend.DataQuery{}, fmt.Errorf("azure logs sql: workspace %q not found", workspaceNameFromTable(baseTable))
	}

	kql := buildKQLFromSQLQuery(logTable, sq.Filters, sq.Columns, sq.OrderBy, sq.Limit, q.TimeRange)

	qt := azureLogAnalytics
	model := dataquery.NewAzureMonitorQuery()
	model.RefId = q.RefID
	model.QueryType = &qt
	model.Subscription = &sub

	resultFmt := dataquery.ResultFormatTable
	dashTime := false
	logsQuery := dataquery.NewAzureLogsQuery()
	logsQuery.Query = &kql
	logsQuery.Resources = []string{ws.Id}
	logsQuery.ResultFormat = &resultFmt
	logsQuery.DashboardTime = &dashTime

	model.AzureLogAnalytics = logsQuery

	raw, err := json.Marshal(model)
	if err != nil {
		return backend.DataQuery{}, err
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return backend.DataQuery{}, err
	}
	payload["grafanaSql"] = true
	raw, err = json.Marshal(payload)
	if err != nil {
		return backend.DataQuery{}, err
	}

	return backend.DataQuery{
		RefID:         q.RefID,
		QueryType:     azureLogAnalytics,
		TimeRange:     q.TimeRange,
		Interval:      q.Interval,
		MaxDataPoints: q.MaxDataPoints,
		JSON:          raw,
	}, nil
}

func buildKQLFromSQLQuery(tableName string, filters []schemas.ColumnFilter, columns []string, orderBy []schemas.OrderByColumn, limit *int64, tr backend.TimeRange) string {
	var sb strings.Builder
	sb.WriteString(tableName)

	sb.WriteString(fmt.Sprintf("\n| where TimeGenerated >= datetime(%s) and TimeGenerated <= datetime(%s)",
		tr.From.UTC().Format(time.RFC3339),
		tr.To.UTC().Format(time.RFC3339)))

	for _, f := range filters {
		if f.Name == "" || len(f.Conditions) == 0 {
			continue
		}
		if strings.EqualFold(f.Name, "TimeGenerated") {
			continue
		}
		for _, cond := range f.Conditions {
			clause := kqlFilterClause(f.Name, cond)
			if clause != "" {
				sb.WriteString("\n| where ")
				sb.WriteString(clause)
			}
		}
	}

	if len(columns) > 0 {
		sb.WriteString("\n| project ")
		sb.WriteString(strings.Join(columns, ", "))
	}

	if len(orderBy) > 0 {
		parts := make([]string, 0, len(orderBy))
		for _, o := range orderBy {
			dir := "asc"
			if o.Desc {
				dir = "desc"
			}
			parts = append(parts, fmt.Sprintf("%s %s", o.Name, dir))
		}
		sb.WriteString("\n| order by ")
		sb.WriteString(strings.Join(parts, ", "))
	}

	if limit != nil && *limit > 0 {
		sb.WriteString(fmt.Sprintf("\n| take %d", *limit))
	}

	return sb.String()
}

func kqlFilterClause(column string, cond schemas.FilterCondition) string {
	switch cond.Operator {
	case schemas.OperatorEquals:
		return fmt.Sprintf("%s == %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorNotEquals:
		return fmt.Sprintf("%s != %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorGreaterThan:
		return fmt.Sprintf("%s > %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorGreaterThanOrEqual:
		return fmt.Sprintf("%s >= %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorLessThan:
		return fmt.Sprintf("%s < %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorLessThanOrEqual:
		return fmt.Sprintf("%s <= %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorLike:
		return fmt.Sprintf("%s contains %s", column, kqlLiteral(cond.Value))
	case schemas.OperatorIn:
		if len(cond.Values) == 0 {
			return ""
		}
		literals := make([]string, 0, len(cond.Values))
		for _, v := range cond.Values {
			literals = append(literals, kqlLiteral(v))
		}
		return fmt.Sprintf("%s in (%s)", column, strings.Join(literals, ", "))
	default:
		return ""
	}
}

func kqlLiteral(v any) string {
	if v == nil {
		return "''"
	}
	switch val := v.(type) {
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%g", val)
	case float32:
		return fmt.Sprintf("%g", val)
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", val)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case string:
		escaped := strings.ReplaceAll(val, "'", "\\'")
		return fmt.Sprintf("'%s'", escaped)
	default:
		escaped := strings.ReplaceAll(fmt.Sprint(val), "'", "\\'")
		return fmt.Sprintf("'%s'", escaped)
	}
}

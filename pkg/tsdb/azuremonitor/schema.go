package azuremonitor

import (
	"context"

	schemas "github.com/grafana/schemads"
)

type compositeSchema struct {
	metrics *metricsSchema
	logs    *logAnalyticsSchema
}

func newCompositeSchema(metrics *metricsSchema, logs *logAnalyticsSchema) *compositeSchema {
	return &compositeSchema{metrics: metrics, logs: logs}
}

func (c *compositeSchema) Schema(ctx context.Context, req *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	mResp, mErr := c.metrics.Schema(ctx, req)
	lResp, lErr := c.logs.Schema(ctx, req)

	if mErr != nil && lErr != nil {
		return mResp, mErr
	}

	merged := &schemas.SchemaResponse{FullSchema: &schemas.Schema{}}

	if mErr == nil && mResp.FullSchema != nil {
		merged.FullSchema.Tables = append(merged.FullSchema.Tables, mResp.FullSchema.Tables...)
		merged.FullSchema.Functions = append(merged.FullSchema.Functions, mResp.FullSchema.Functions...)
		merged.FullSchema.TableParameterValues = mResp.FullSchema.TableParameterValues
	}
	if lErr == nil && lResp.FullSchema != nil {
		merged.FullSchema.Tables = append(merged.FullSchema.Tables, lResp.FullSchema.Tables...)
		merged.FullSchema.Functions = append(merged.FullSchema.Functions, lResp.FullSchema.Functions...)
		if lResp.FullSchema.TableParameterValues != nil {
			if merged.FullSchema.TableParameterValues == nil {
				merged.FullSchema.TableParameterValues = make(map[string]map[string][]string)
			}
			for k, v := range lResp.FullSchema.TableParameterValues {
				merged.FullSchema.TableParameterValues[k] = v
			}
		}
	}

	var errMsgs []string
	if mResp != nil && mResp.Errors != "" {
		errMsgs = append(errMsgs, mResp.Errors)
	}
	if lResp != nil && lResp.Errors != "" {
		errMsgs = append(errMsgs, lResp.Errors)
	}
	if len(errMsgs) > 0 {
		for i, m := range errMsgs {
			if i == 0 {
				merged.Errors = m
			} else {
				merged.Errors += "; " + m
			}
		}
	}

	return merged, nil
}

func (c *compositeSchema) Tables(ctx context.Context, req *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	mResp, mErr := c.metrics.Tables(ctx, req)
	lResp, lErr := c.logs.Tables(ctx, req)

	if mErr != nil && lErr != nil {
		return mResp, mErr
	}

	merged := &schemas.TablesResponse{}
	if mErr == nil && mResp != nil {
		merged.Tables = append(merged.Tables, mResp.Tables...)
		if mResp.TableParameters != nil {
			merged.TableParameters = make(map[string][]schemas.TableParameter)
			for k, v := range mResp.TableParameters {
				merged.TableParameters[k] = v
			}
		}
	}
	if lErr == nil && lResp != nil {
		merged.Tables = append(merged.Tables, lResp.Tables...)
		if lResp.TableParameters != nil {
			if merged.TableParameters == nil {
				merged.TableParameters = make(map[string][]schemas.TableParameter)
			}
			for k, v := range lResp.TableParameters {
				merged.TableParameters[k] = v
			}
		}
	}

	return merged, nil
}

func (c *compositeSchema) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	var metricsTables, logsTables []string
	for _, t := range req.Tables {
		if isLogsTable(stripTableParameterValues(t)) {
			logsTables = append(logsTables, t)
		} else {
			metricsTables = append(metricsTables, t)
		}
	}

	merged := &schemas.ColumnsResponse{Columns: make(map[string][]schemas.Column)}

	if len(metricsTables) > 0 {
		mReq := &schemas.ColumnsRequest{Tables: metricsTables, TableParameters: req.TableParameters}
		mResp, err := c.metrics.Columns(ctx, mReq)
		if err == nil && mResp != nil {
			for k, v := range mResp.Columns {
				merged.Columns[k] = v
			}
		}
	}

	if len(logsTables) > 0 {
		lReq := &schemas.ColumnsRequest{Tables: logsTables, TableParameters: req.TableParameters}
		lResp, err := c.logs.Columns(ctx, lReq)
		if err == nil && lResp != nil {
			for k, v := range lResp.Columns {
				merged.Columns[k] = v
			}
		}
	}

	return merged, nil
}

func (c *compositeSchema) TableParameterValues(ctx context.Context, req *schemas.TableParameterValuesRequest) (*schemas.TableParametersValuesResponse, error) {
	table := stripTableParameterValues(req.Table)
	if isLogsTable(table) {
		return c.logs.TableParameterValues(ctx, req)
	}
	return c.metrics.TableParameterValues(ctx, req)
}

func (c *compositeSchema) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	table := stripTableParameterValues(req.Table)
	if isLogsTable(table) {
		return nil, schemas.ErrColumnValuesNotImplemented
	}
	return c.metrics.ColumnValues(ctx, req)
}

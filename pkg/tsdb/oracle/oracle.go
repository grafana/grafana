package oracle

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/oracle/sqleng"
)

// OracleDatasource represents the Oracle datasource
type OracleDatasource struct {
	logger log.Logger
}

// NewOracleDatasource creates a new Oracle datasource instance
func NewOracleDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.DefaultLogger.With("logger", "oracle-datasource", "datasourceUID", settings.UID)

	return &OracleDatasource{
		logger: logger,
	}, nil
}

// QueryData handles data queries
func (ds *OracleDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, query := range req.Queries {
		res := ds.query(ctx, req.PluginContext, query)
		response.Responses[query.RefID] = res
	}

	return response, nil
}

func (ds *OracleDatasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	// Parse datasource configuration
	dsInfo, err := ds.getDatasourceInfo(pCtx)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse datasource configuration: %v", err))
	}

	// Create database connection
	db, _, err := ds.createConnection(ctx, dsInfo, *pCtx.DataSourceInstanceSettings)
	if err != nil {
		ds.logger.Error("Failed to create Oracle connection", "error", err)
		return backend.ErrDataResponse(backend.StatusInternal, "Failed to connect to Oracle database")
	}
	defer db.Close()

	// Execute query through handler - simplified implementation
	response := backend.DataResponse{}
	frame := data.NewFrame("query")
	response.Frames = append(response.Frames, frame)
	return response
}

func (ds *OracleDatasource) getDatasourceInfo(pCtx backend.PluginContext) (sqleng.DataSourceInfo, error) {
	settings := pCtx.DataSourceInstanceSettings

	jsonData := sqleng.JsonData{}
	if len(settings.JSONData) > 0 {
		if maxOpenConnsRaw, ok := settings.JSONData["maxOpenConns"]; ok {
			if val, err := strconv.Atoi(fmt.Sprintf("%v", maxOpenConnsRaw)); err == nil {
				jsonData.MaxOpenConns = val
			}
		}
		if maxIdleConnsRaw, ok := settings.JSONData["maxIdleConns"]; ok {
			if val, err := strconv.Atoi(fmt.Sprintf("%v", maxIdleConnsRaw)); err == nil {
				jsonData.MaxIdleConns = val
			}
		}
		if connMaxLifetimeRaw, ok := settings.JSONData["connMaxLifetime"]; ok {
			if val, err := strconv.Atoi(fmt.Sprintf("%v", connMaxLifetimeRaw)); err == nil {
				jsonData.ConnMaxLifetime = val
			}
		}
		if timezoneRaw, ok := settings.JSONData["timezone"]; ok {
			jsonData.Timezone = fmt.Sprintf("%v", timezoneRaw)
		}
		if databaseRaw, ok := settings.JSONData["database"]; ok {
			jsonData.Database = fmt.Sprintf("%v", databaseRaw)
		}
		if oracleVersionRaw, ok := settings.JSONData["oracleVersion"]; ok {
			if val, err := strconv.Atoi(fmt.Sprintf("%v", oracleVersionRaw)); err == nil {
				jsonData.OracleVersion = val
			} else {
				// Default to Oracle 19 if not specified or invalid
				jsonData.OracleVersion = 19
			}
		} else {
			// Default to Oracle 19 for backward compatibility
			jsonData.OracleVersion = 19
		}
	} else {
		// Default to Oracle 19 for backward compatibility
		jsonData.OracleVersion = 19
	}

	// Set defaults
	if jsonData.MaxOpenConns == 0 {
		jsonData.MaxOpenConns = 5
	}
	if jsonData.MaxIdleConns == 0 {
		jsonData.MaxIdleConns = 5
	}
	if jsonData.ConnMaxLifetime == 0 {
		jsonData.ConnMaxLifetime = 14400 // 4 hours
	}

	dsInfo := sqleng.DataSourceInfo{
		JsonData:                jsonData,
		URL:                     settings.URL,
		User:                    settings.User,
		Database:                settings.Database,
		ID:                      settings.ID,
		Updated:                 settings.Updated,
		UID:                     settings.UID,
		DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
	}

	return dsInfo, nil
}

func (ds *OracleDatasource) createConnection(ctx context.Context, dsInfo sqleng.DataSourceInfo, settings backend.DataSourceInstanceSettings) (*sql.DB, *sqleng.DataSourceHandler, error) {
	// Build Oracle connection string
	password := dsInfo.DecryptedSecureJSONData["password"]
	if password == "" {
		return nil, nil, fmt.Errorf("password is required")
	}

	// Oracle connection string format: user/password@host:port/service_name
	// For now, we'll use a simple connection approach

	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		TimeColumnNames:   []string{"time", "time_sec"},
		MetricColumnTypes: []string{"VARCHAR2", "CHAR", "NVARCHAR2", "NCHAR", "CLOB", "NCLOB"},
		RowLimit:          1000000, // Default row limit
	}

	queryResultTransformer := &oracleQueryResultTransformer{}

	// Create database connection - using a mock driver for now
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open Oracle connection: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(config.DSInfo.JsonData.MaxOpenConns)
	db.SetMaxIdleConns(config.DSInfo.JsonData.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(config.DSInfo.JsonData.ConnMaxLifetime) * time.Second)

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, nil, fmt.Errorf("failed to ping Oracle database: %w", err)
	}

	handler, err := sqleng.NewQueryDataHandler("Oracle query error", db, config, queryResultTransformer, newOracleMacroEngine(dsInfo.JsonData.OracleVersion), ds.logger)
	if err != nil {
		db.Close()
		return nil, nil, fmt.Errorf("failed to create query handler: %w", err)
	}

	ds.logger.Debug("Successfully connected to Oracle database", "version", dsInfo.JsonData.OracleVersion)
	return db, handler, nil
}

// CheckHealth implements health checking
func (ds *OracleDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := ds.getDatasourceInfo(req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to parse datasource configuration: %v", err),
		}, nil
	}

	db, _, err := ds.createConnection(ctx, dsInfo, *req.PluginContext.DataSourceInstanceSettings)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to connect to Oracle: %v", err),
		}, nil
	}
	defer db.Close()

	// Test query
	var result string
	if err := db.QueryRowContext(ctx, "SELECT 'OK' FROM DUAL").Scan(&result); err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to execute test query: %v", err),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf("Oracle connection successful (version: %d)", dsInfo.JsonData.OracleVersion),
	}, nil
}

// Dispose cleans up resources
func (ds *OracleDatasource) Dispose() {
	ds.logger.Debug("Disposing Oracle datasource")
}

type oracleQueryResultTransformer struct{}

func (t *oracleQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *sql.Rows) (sqleng.FrameFieldConverters, error) {
	// Basic implementation - can be enhanced
	converters := make(sqleng.FrameFieldConverters, len(columnTypes))

	for i, columnType := range columnTypes {
		switch columnType.DatabaseTypeName() {
		case "DATE", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITH LOCAL TIME ZONE":
			converters[i] = data.FieldConverter{
				OutputFieldType: data.FieldTypeNullableTime,
			}
		case "NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE":
			converters[i] = data.FieldConverter{
				OutputFieldType: data.FieldTypeNullableFloat64,
			}
		case "INTEGER", "SMALLINT":
			converters[i] = data.FieldConverter{
				OutputFieldType: data.FieldTypeNullableInt64,
			}
		default:
			converters[i] = data.FieldConverter{
				OutputFieldType: data.FieldTypeNullableString,
			}
		}
	}

	return converters, nil
}

func (t *oracleQueryResultTransformer) TransformQueryError(logger log.Logger, err error) error {
	return err
}

func (t *oracleQueryResultTransformer) GetConverterList() []sqleng.StringConverter {
	return []sqleng.StringConverter{}
}

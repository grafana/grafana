package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/mysql/sqleng"
)

const distinctValuesLimit = 100

var (
	numberOperators = []schemas.Operator{
		schemas.OperatorGreaterThan,
		schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan,
		schemas.OperatorLessThanOrEqual,
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
		schemas.OperatorIn,
	}
	stringOperators = []schemas.Operator{
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
		schemas.OperatorLike,
		schemas.OperatorIn,
	}
	equalityOperators = []schemas.Operator{
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
	}
	timeRangeOperators = []schemas.Operator{
		schemas.OperatorGreaterThan,
		schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan,
		schemas.OperatorLessThanOrEqual,
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
	}
)

type mysqlSchema struct {
	service *Service
	logger  log.Logger
}

func newMySQLSchema(service *Service, logger log.Logger) *mysqlSchema {
	return &mysqlSchema{service: service, logger: logger}
}

func (s *mysqlSchema) getHandler(ctx context.Context, pc backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.service.im.Get(ctx, pc)
	if err != nil {
		return nil, err
	}
	return i.(*sqleng.DataSourceHandler), nil
}

// Schema implements schemas.SchemaHandler.
func (s *mysqlSchema) Schema(ctx context.Context, req *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	tableResponse, err := s.Tables(ctx, &schemas.TablesRequest{CommonRequest: req.CommonRequest})
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	db := h.GetDB()
	schemaTables := make([]schemas.Table, 0, len(tableResponse.Tables))
	for _, t := range tableResponse.Tables {
		cols, err := s.queryColumns(ctx, db, t)
		if err != nil {
			s.logger.Warn("Failed to query columns for table", "table", t, "error", err)
			continue
		}
		schemaTables = append(schemaTables, schemas.Table{
			Name:    t,
			Columns: cols,
		})
	}

	return &schemas.SchemaResponse{
		FullSchema: &schemas.Schema{
			Tables: schemaTables,
		},
	}, nil
}

// Tables implements schemas.TablesHandler.
func (s *mysqlSchema) Tables(ctx context.Context, req *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.TablesResponse{
			Errors: map[string]string{"": err.Error()},
		}, nil
	}

	tables, err := s.queryTables(ctx, h.GetDB())
	if err != nil {
		return &schemas.TablesResponse{
			Errors: map[string]string{"": err.Error()},
		}, nil
	}

	return &schemas.TablesResponse{Tables: tables}, nil
}

// Columns implements schemas.ColumnsHandler.
func (s *mysqlSchema) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		errs := make(map[string]string, len(req.Tables))
		for _, t := range req.Tables {
			errs[t] = err.Error()
		}
		return &schemas.ColumnsResponse{Columns: map[string][]schemas.Column{}, Errors: errs}, nil
	}

	tables := make([]string, 0, len(req.Tables))
	for _, t := range req.Tables {
		if t != "" {
			tables = append(tables, t)
		}
	}
	if len(tables) == 0 {
		return &schemas.ColumnsResponse{Columns: map[string][]schemas.Column{}}, nil
	}

	db := h.GetDB()
	result := make(map[string][]schemas.Column, len(tables))
	errs := make(map[string]string)
	for _, table := range tables {
		cols, err := s.queryColumns(ctx, db, table)
		if err != nil {
			errs[table] = err.Error()
			continue
		}
		result[table] = cols
	}

	resp := &schemas.ColumnsResponse{Columns: result}
	if len(errs) > 0 {
		resp.Errors = errs
	}
	return resp, nil
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (s *mysqlSchema) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			Errors: map[string]string{req.Table: err.Error()},
		}, nil
	}

	db := h.GetDB()
	response := &schemas.ColumnValuesResponse{
		ColumnValues: make(map[string][]string, len(req.Columns)),
	}
	if len(req.Columns) == 0 {
		return response, nil
	}

	safeTable := "`" + strings.ReplaceAll(req.Table, "`", "``") + "`"
	parts := make([]string, len(req.Columns))
	for i, col := range req.Columns {
		safeCol := "`" + strings.ReplaceAll(col, "`", "``") + "`"
		parts[i] = fmt.Sprintf(
			"SELECT '%s' AS col_name, CAST(%s AS CHAR) AS val FROM (SELECT DISTINCT %s FROM %s WHERE %s IS NOT NULL ORDER BY %s LIMIT %d) sub_%d",
			escapeSQLString(col), safeCol, safeCol, safeTable, safeCol, safeCol, distinctValuesLimit, i,
		)
		response.ColumnValues[col] = make([]string, 0)
	}
	query := strings.Join(parts, " UNION ALL ")

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			Errors: map[string]string{req.Table: err.Error()},
		}, nil
	}
	defer func() {
		if err := rows.Close(); err != nil {
			s.logger.Warn("Failed to close rows", "error", err)
		}
	}()

	for rows.Next() {
		var colName, value string
		if err := rows.Scan(&colName, &value); err != nil {
			return &schemas.ColumnValuesResponse{
				Errors: map[string]string{req.Table: err.Error()},
			}, nil
		}
		response.ColumnValues[colName] = append(response.ColumnValues[colName], value)
	}

	return response, nil
}

// TableParameterValues implements schemas.TableParameterValuesHandler.
func (s *mysqlSchema) TableParameterValues(_ context.Context, _ *schemas.TableParameterValuesRequest) (*schemas.TableParametersValuesResponse, error) {
	return &schemas.TableParametersValuesResponse{
		TableParameterValues: map[string][]string{},
	}, nil
}

func (s *mysqlSchema) queryTables(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE IN ('BASE TABLE', 'VIEW') ORDER BY TABLE_NAME")
	if err != nil {
		return nil, fmt.Errorf("querying tables: %w", err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			s.logger.Warn("Failed to close rows", "error", err)
		}
	}()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scanning table name: %w", err)
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func (s *mysqlSchema) queryColumns(ctx context.Context, db *sql.DB, table string) ([]schemas.Column, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
		 FROM INFORMATION_SCHEMA.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		 ORDER BY ORDINAL_POSITION`, table)
	if err != nil {
		return nil, fmt.Errorf("querying columns for %s: %w", table, err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			s.logger.Warn("Failed to close rows", "error", err)
		}
	}()

	var columns []schemas.Column
	for rows.Next() {
		var name, dataType string
		var precision, scale sql.NullInt64
		if err := rows.Scan(&name, &dataType, &precision, &scale); err != nil {
			return nil, fmt.Errorf("scanning column: %w", err)
		}

		ct, ops := mysqlTypeToSchemaType(dataType)
		col := schemas.Column{
			Name:      name,
			Type:      ct,
			Operators: ops,
		}

		if ct == schemas.ColumnTypeDecimal && precision.Valid && scale.Valid {
			p := int(precision.Int64)
			sc := int(scale.Int64)
			col.Precision = &p
			col.Scale = &sc
		}

		columns = append(columns, col)
	}
	return columns, rows.Err()
}

func escapeSQLString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

func mysqlTypeToSchemaType(dataType string) (schemas.ColumnType, []schemas.Operator) {
	switch strings.ToLower(dataType) {
	case "tinyint":
		return schemas.ColumnTypeInt8, numberOperators
	case "smallint":
		return schemas.ColumnTypeInt16, numberOperators
	case "mediumint", "int", "integer":
		return schemas.ColumnTypeInt32, numberOperators
	case "bigint":
		return schemas.ColumnTypeInt64, numberOperators
	case "float":
		return schemas.ColumnTypeFloat32, numberOperators
	case "double", "real":
		return schemas.ColumnTypeFloat64, numberOperators
	case "decimal", "numeric":
		return schemas.ColumnTypeDecimal, numberOperators
	case "date":
		return schemas.ColumnTypeDate, timeRangeOperators
	case "datetime":
		return schemas.ColumnTypeDatetime, timeRangeOperators
	case "timestamp":
		return schemas.ColumnTypeTimestamp, timeRangeOperators
	case "time":
		return schemas.ColumnTypeTime, timeRangeOperators
	case "year":
		return schemas.ColumnTypeYear, numberOperators
	case "char", "varchar", "tinytext", "text", "mediumtext", "longtext":
		return schemas.ColumnTypeString, stringOperators
	case "json":
		return schemas.ColumnTypeJSON, equalityOperators
	case "enum":
		return schemas.ColumnTypeEnum, equalityOperators
	case "set":
		return schemas.ColumnTypeSet, equalityOperators
	case "binary", "varbinary", "blob", "tinyblob", "mediumblob", "longblob":
		return schemas.ColumnTypeBlob, nil
	case "bit":
		return schemas.ColumnTypeBit, equalityOperators
	case "boolean", "bool":
		return schemas.ColumnTypeBoolean, equalityOperators
	default:
		return schemas.ColumnTypeString, stringOperators
	}
}

func preprocessGrafanaSQLQueries(req *backend.QueryDataRequest) *backend.QueryDataRequest {
	if req == nil || len(req.Queries) == 0 {
		return req
	}

	queries := make([]backend.DataQuery, 0, len(req.Queries))
	for _, q := range req.Queries {
		var sq schemas.Query
		if err := json.Unmarshal(q.JSON, &sq); err != nil {
			queries = append(queries, q)
			continue
		}
		if !sq.GrafanaSql {
			queries = append(queries, q)
			continue
		}

		sqlQuery, err := sq.ToSQL(schemas.DialectMySQL)
		if err != nil {
			backend.Logger.Error("Failed to build SQL query", "error", err.Error())
			continue
		}

		queryJSON, err := json.Marshal(map[string]any{
			"rawSql": sqlQuery,
			"format": "table",
		})
		if err != nil {
			backend.Logger.Error("Failed to marshal SQL query", "error", err.Error())
			continue
		}

		q.JSON = queryJSON
		queries = append(queries, q)
	}

	return &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Headers:       req.Headers,
		Queries:       queries,
	}
}

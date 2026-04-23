package mssql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/mssql/sqleng"
)

const (
	distinctValuesLimit = 100
	defaultSchema       = "dbo"
	schemaParam         = "schema"
)

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

type mssqlSchema struct {
	service *Service
	logger  log.Logger
}

func newMSSQLSchema(service *Service, logger log.Logger) *mssqlSchema {
	return &mssqlSchema{service: service, logger: logger}
}

func (s *mssqlSchema) getHandler(ctx context.Context, pc backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.service.im.Get(ctx, pc)
	if err != nil {
		return nil, err
	}
	return i.(*sqleng.DataSourceHandler), nil
}

func tableParameters() []schemas.TableParameter {
	return []schemas.TableParameter{
		{Name: schemaParam, Root: true, Required: false},
	}
}

func resolveSchema(params map[string]string) string {
	if params != nil {
		if v, ok := params[schemaParam]; ok && v != "" {
			return v
		}
	}
	return defaultSchema
}

// Schema implements schemas.SchemaHandler.
func (s *mssqlSchema) Schema(ctx context.Context, req *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	db, err := h.GetDB(ctx)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	schemaNames, err := s.querySchemas(ctx, db)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	var allTables []schemas.Table
	tpValues := make(map[string]map[string][]string)

	for _, sc := range schemaNames {
		tables, err := s.queryTables(ctx, db, sc)
		if err != nil {
			s.logger.Warn("Failed to query tables for schema", "schema", sc, "error", err)
			continue
		}
		for _, t := range tables {
			cols, err := s.queryColumns(ctx, db, sc, t)
			if err != nil {
				s.logger.Warn("Failed to query columns", "schema", sc, "table", t, "error", err)
				continue
			}
			allTables = append(allTables, schemas.Table{
				Name:            t,
				TableParameters: tableParameters(),
				Columns:         cols,
			})
			if tpValues[t] == nil {
				tpValues[t] = map[string][]string{}
			}
			tpValues[t][schemaParam] = append(tpValues[t][schemaParam], sc)
		}
	}

	return &schemas.SchemaResponse{
		FullSchema: &schemas.Schema{
			Tables:               allTables,
			TableParameterValues: tpValues,
		},
	}, nil
}

// Tables implements schemas.TablesHandler.
func (s *mssqlSchema) Tables(ctx context.Context, req *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.TablesResponse{
			Errors: map[string]string{"": err.Error()},
		}, nil
	}

	db, err := h.GetDB(ctx)
	if err != nil {
		return &schemas.TablesResponse{
			Errors: map[string]string{"": err.Error()},
		}, nil
	}

	schemaNames, err := s.querySchemas(ctx, db)
	if err != nil {
		return &schemas.TablesResponse{
			Errors: map[string]string{"": err.Error()},
		}, nil
	}

	var tables []string
	tp := make(map[string][]schemas.TableParameter)
	for _, sc := range schemaNames {
		ts, err := s.queryTables(ctx, db, sc)
		if err != nil {
			s.logger.Warn("Failed to query tables for schema", "schema", sc, "error", err)
			continue
		}
		for _, t := range ts {
			tables = append(tables, t)
			tp[t] = tableParameters()
		}
	}

	return &schemas.TablesResponse{
		Tables:          tables,
		TableParameters: tp,
	}, nil
}

// Columns implements schemas.ColumnsHandler.
func (s *mssqlSchema) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		errs := make(map[string]string, len(req.Tables))
		for _, t := range req.Tables {
			errs[t] = err.Error()
		}
		return &schemas.ColumnsResponse{Columns: map[string][]schemas.Column{}, Errors: errs}, nil
	}

	db, err := h.GetDB(ctx)
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

	sc := resolveSchema(req.TableParameters)
	result := make(map[string][]schemas.Column, len(tables))
	errs := make(map[string]string)
	for _, table := range tables {
		cols, err := s.queryColumns(ctx, db, sc, table)
		if err != nil {
			errs[table] = err.Error()
			continue
		}
		if len(cols) > 0 {
			result[table] = cols
		} else {
			errs[table] = "table not found or has no columns"
		}
	}

	resp := &schemas.ColumnsResponse{Columns: result}
	if len(errs) > 0 {
		resp.Errors = errs
	}
	return resp, nil
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (s *mssqlSchema) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			Errors: map[string]string{req.Table: err.Error()},
		}, nil
	}

	db, err := h.GetDB(ctx)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			Errors: map[string]string{req.Table: err.Error()},
		}, nil
	}

	sc := resolveSchema(req.TableParameters)
	response := &schemas.ColumnValuesResponse{
		ColumnValues: make(map[string][]string, len(req.Columns)),
	}
	if len(req.Columns) == 0 {
		return response, nil
	}

	safeSchema := "[" + strings.ReplaceAll(sc, "]", "]]") + "]"
	safeTable := "[" + strings.ReplaceAll(req.Table, "]", "]]") + "]"
	qualifiedTable := safeSchema + "." + safeTable

	parts := make([]string, len(req.Columns))
	for i, col := range req.Columns {
		safeCol := "[" + strings.ReplaceAll(col, "]", "]]") + "]"
		parts[i] = fmt.Sprintf(
			"SELECT '%s' AS col_name, CAST(%s AS NVARCHAR(MAX)) AS val FROM (SELECT DISTINCT TOP %d %s FROM %s WHERE %s IS NOT NULL) sub_%d",
			escapeSQLString(col), safeCol, distinctValuesLimit, safeCol, qualifiedTable, safeCol, i,
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
	defer rows.Close()

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
func (s *mssqlSchema) TableParameterValues(ctx context.Context, req *schemas.TableParameterValuesRequest) (*schemas.TableParametersValuesResponse, error) {
	if req.TableParameter != schemaParam {
		return &schemas.TableParametersValuesResponse{
			TableParameterValues: map[string][]string{},
		}, nil
	}

	h, err := s.getHandler(ctx, req.PluginContext)
	if err != nil {
		return &schemas.TableParametersValuesResponse{
			Errors: map[string]string{schemaParam: err.Error()},
		}, nil
	}

	db, err := h.GetDB(ctx)
	if err != nil {
		return &schemas.TableParametersValuesResponse{
			Errors: map[string]string{schemaParam: err.Error()},
		}, nil
	}

	schemaNames, err := s.querySchemas(ctx, db)
	if err != nil {
		return &schemas.TableParametersValuesResponse{
			Errors: map[string]string{schemaParam: err.Error()},
		}, nil
	}

	return &schemas.TableParametersValuesResponse{
		TableParameterValues: map[string][]string{
			schemaParam: schemaNames,
		},
	}, nil
}

func (s *mssqlSchema) querySchemas(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
		 WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA', 'sys', 'guest')
		 ORDER BY SCHEMA_NAME`)
	if err != nil {
		return nil, fmt.Errorf("querying schemas: %w", err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func (s *mssqlSchema) queryTables(ctx context.Context, db *sql.DB, schema string) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
		 WHERE TABLE_SCHEMA = @p1 AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
		 ORDER BY TABLE_NAME`, schema)
	if err != nil {
		return nil, fmt.Errorf("querying tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func (s *mssqlSchema) queryColumns(ctx context.Context, db *sql.DB, schema, table string) ([]schemas.Column, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
		 FROM INFORMATION_SCHEMA.COLUMNS
		 WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
		 ORDER BY ORDINAL_POSITION`, schema, table)
	if err != nil {
		return nil, fmt.Errorf("querying columns for %s.%s: %w", schema, table, err)
	}
	defer rows.Close()

	var columns []schemas.Column
	for rows.Next() {
		var name, dataType string
		var precision, scale sql.NullInt64
		if err := rows.Scan(&name, &dataType, &precision, &scale); err != nil {
			return nil, fmt.Errorf("scanning column: %w", err)
		}

		ct, ops := mssqlTypeToSchemaType(dataType)
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

func mssqlTypeToSchemaType(dataType string) (schemas.ColumnType, []schemas.Operator) {
	switch strings.ToLower(dataType) {
	case "tinyint":
		return schemas.ColumnTypeUint8, numberOperators
	case "smallint":
		return schemas.ColumnTypeInt16, numberOperators
	case "int":
		return schemas.ColumnTypeInt32, numberOperators
	case "bigint":
		return schemas.ColumnTypeInt64, numberOperators
	case "real":
		return schemas.ColumnTypeFloat32, numberOperators
	case "float":
		return schemas.ColumnTypeFloat64, numberOperators
	case "decimal", "numeric", "money", "smallmoney":
		return schemas.ColumnTypeDecimal, numberOperators
	case "date":
		return schemas.ColumnTypeDate, timeRangeOperators
	case "datetime", "datetime2", "smalldatetime", "datetimeoffset":
		return schemas.ColumnTypeDatetime, timeRangeOperators
	case "time":
		return schemas.ColumnTypeTime, timeRangeOperators
	case "bit":
		return schemas.ColumnTypeBoolean, equalityOperators
	case "binary", "varbinary", "image":
		return schemas.ColumnTypeBlob, nil
	case "char", "varchar", "nchar", "nvarchar", "text", "ntext",
		"uniqueidentifier", "xml", "sql_variant", "sysname":
		return schemas.ColumnTypeString, stringOperators
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

		if sc, ok := sq.TableParameterValues[schemaParam]; ok {
			if schemaStr, ok := sc.(string); ok && schemaStr != "" {
				sq.Table = schemaStr + "." + sq.Table
			}
		}

		sqlQuery, err := sq.ToSQL(schemas.DialectSQLServer)
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

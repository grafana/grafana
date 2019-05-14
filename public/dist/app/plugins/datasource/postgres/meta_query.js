var PostgresMetaQuery = /** @class */ (function () {
    function PostgresMetaQuery(target, queryModel) {
        this.target = target;
        this.queryModel = queryModel;
    }
    PostgresMetaQuery.prototype.getOperators = function (datatype) {
        switch (datatype) {
            case 'float4':
            case 'float8': {
                return ['=', '!=', '<', '<=', '>', '>='];
            }
            case 'text':
            case 'varchar':
            case 'char': {
                return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', '~', '~*', '!~', '!~*'];
            }
            default: {
                return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'];
            }
        }
    };
    // quote identifier as literal to use in metadata queries
    PostgresMetaQuery.prototype.quoteIdentAsLiteral = function (value) {
        return this.queryModel.quoteLiteral(this.queryModel.unquoteIdentifier(value));
    };
    PostgresMetaQuery.prototype.findMetricTable = function () {
        // query that returns first table found that has a timestamp(tz) column and a float column
        var query = "\nSELECT\n\tquote_ident(table_name) as table_name,\n\t( SELECT\n\t    quote_ident(column_name) as column_name\n\t  FROM information_schema.columns c\n    WHERE\n      c.table_schema = t.table_schema AND\n      c.table_name = t.table_name AND\n      udt_name IN ('timestamptz','timestamp')\n    ORDER BY ordinal_position LIMIT 1\n  ) AS time_column,\n  ( SELECT\n      quote_ident(column_name) AS column_name\n    FROM information_schema.columns c\n    WHERE\n      c.table_schema = t.table_schema AND\n      c.table_name = t.table_name AND\n      udt_name='float8'\n    ORDER BY ordinal_position LIMIT 1\n  ) AS value_column\nFROM information_schema.tables t\nWHERE ";
        query += this.buildSchemaConstraint();
        query += " AND\n  EXISTS\n  ( SELECT 1\n    FROM information_schema.columns c\n    WHERE\n      c.table_schema = t.table_schema AND\n      c.table_name = t.table_name AND\n      udt_name IN ('timestamptz','timestamp')\n  ) AND\n  EXISTS\n  ( SELECT 1\n    FROM information_schema.columns c\n    WHERE\n      c.table_schema = t.table_schema AND\n      c.table_name = t.table_name AND\n      udt_name='float8'\n  )\nLIMIT 1\n;";
        return query;
    };
    PostgresMetaQuery.prototype.buildSchemaConstraint = function () {
        var query = "\ntable_schema IN (\n  SELECT\n    CASE WHEN trim(s[i]) = '\"$user\"' THEN user ELSE trim(s[i]) END\n  FROM\n    generate_series(\n      array_lower(string_to_array(current_setting('search_path'),','),1),\n      array_upper(string_to_array(current_setting('search_path'),','),1)\n    ) as i,\n    string_to_array(current_setting('search_path'),',') s\n)";
        return query;
    };
    PostgresMetaQuery.prototype.buildTableConstraint = function (table) {
        var query = '';
        // check for schema qualified table
        if (table.includes('.')) {
            var parts = table.split('.');
            query = 'table_schema = ' + this.quoteIdentAsLiteral(parts[0]);
            query += ' AND table_name = ' + this.quoteIdentAsLiteral(parts[1]);
            return query;
        }
        else {
            query = this.buildSchemaConstraint();
            query += ' AND table_name = ' + this.quoteIdentAsLiteral(table);
            return query;
        }
    };
    PostgresMetaQuery.prototype.buildTableQuery = function () {
        var query = 'SELECT quote_ident(table_name) FROM information_schema.tables WHERE ';
        query += this.buildSchemaConstraint();
        query += ' ORDER BY table_name';
        return query;
    };
    PostgresMetaQuery.prototype.buildColumnQuery = function (type) {
        var query = 'SELECT quote_ident(column_name) FROM information_schema.columns WHERE ';
        query += this.buildTableConstraint(this.target.table);
        switch (type) {
            case 'time': {
                query +=
                    " AND data_type IN ('timestamp without time zone','timestamp with time zone','bigint','integer','double precision','real')";
                break;
            }
            case 'metric': {
                query += " AND data_type IN ('text','character','character varying')";
                break;
            }
            case 'value': {
                query += " AND data_type IN ('bigint','integer','double precision','real')";
                query += ' AND column_name <> ' + this.quoteIdentAsLiteral(this.target.timeColumn);
                break;
            }
            case 'group': {
                query += " AND data_type IN ('text','character','character varying')";
                break;
            }
        }
        query += ' ORDER BY column_name';
        return query;
    };
    PostgresMetaQuery.prototype.buildValueQuery = function (column) {
        var query = 'SELECT DISTINCT quote_literal(' + column + ')';
        query += ' FROM ' + this.target.table;
        query += ' WHERE $__timeFilter(' + this.target.timeColumn + ')';
        query += ' AND ' + column + ' IS NOT NULL';
        query += ' ORDER BY 1 LIMIT 100';
        return query;
    };
    PostgresMetaQuery.prototype.buildDatatypeQuery = function (column) {
        var query = 'SELECT udt_name FROM information_schema.columns WHERE ';
        query += this.buildTableConstraint(this.target.table);
        query += ' AND column_name = ' + this.quoteIdentAsLiteral(column);
        return query;
    };
    PostgresMetaQuery.prototype.buildAggregateQuery = function () {
        var query = 'SELECT DISTINCT proname FROM pg_aggregate ';
        query += 'INNER JOIN pg_proc ON pg_aggregate.aggfnoid = pg_proc.oid ';
        query += 'INNER JOIN pg_type ON pg_type.oid=pg_proc.prorettype ';
        query += "WHERE pronargs=1 AND typname IN ('float8') AND aggkind='n' ORDER BY 1";
        return query;
    };
    return PostgresMetaQuery;
}());
export { PostgresMetaQuery };
//# sourceMappingURL=meta_query.js.map
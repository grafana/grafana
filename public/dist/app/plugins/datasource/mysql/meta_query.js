var MysqlMetaQuery = /** @class */ (function () {
    function MysqlMetaQuery(target, queryModel) {
        this.target = target;
        this.queryModel = queryModel;
    }
    MysqlMetaQuery.prototype.getOperators = function (datatype) {
        switch (datatype) {
            case 'double':
            case 'float': {
                return ['=', '!=', '<', '<=', '>', '>='];
            }
            case 'text':
            case 'tinytext':
            case 'mediumtext':
            case 'longtext':
            case 'varchar':
            case 'char': {
                return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE'];
            }
            default: {
                return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'];
            }
        }
    };
    // quote identifier as literal to use in metadata queries
    MysqlMetaQuery.prototype.quoteIdentAsLiteral = function (value) {
        return this.queryModel.quoteLiteral(this.queryModel.unquoteIdentifier(value));
    };
    MysqlMetaQuery.prototype.findMetricTable = function () {
        // query that returns first table found that has a timestamp(tz) column and a float column
        var query = "\n  SELECT\n    table_name as table_name,\n    ( SELECT\n        column_name as column_name\n      FROM information_schema.columns c\n      WHERE\n        c.table_schema = t.table_schema AND\n        c.table_name = t.table_name AND\n        c.data_type IN ('timestamp', 'datetime')\n      ORDER BY ordinal_position LIMIT 1\n    ) AS time_column,\n    ( SELECT\n        column_name AS column_name\n      FROM information_schema.columns c\n      WHERE\n        c.table_schema = t.table_schema AND\n        c.table_name = t.table_name AND\n        c.data_type IN('float', 'int', 'bigint')\n      ORDER BY ordinal_position LIMIT 1\n    ) AS value_column\n  FROM information_schema.tables t\n  WHERE\n    t.table_schema = database() AND\n    EXISTS\n    ( SELECT 1\n      FROM information_schema.columns c\n      WHERE\n        c.table_schema = t.table_schema AND\n        c.table_name = t.table_name AND\n        c.data_type IN ('timestamp', 'datetime')\n    ) AND\n    EXISTS\n    ( SELECT 1\n      FROM information_schema.columns c\n      WHERE\n        c.table_schema = t.table_schema AND\n        c.table_name = t.table_name AND\n        c.data_type IN('float', 'int', 'bigint')\n    )\n  LIMIT 1\n;";
        return query;
    };
    MysqlMetaQuery.prototype.buildTableConstraint = function (table) {
        var query = '';
        // check for schema qualified table
        if (table.includes('.')) {
            var parts = table.split('.');
            query = 'table_schema = ' + this.quoteIdentAsLiteral(parts[0]);
            query += ' AND table_name = ' + this.quoteIdentAsLiteral(parts[1]);
            return query;
        }
        else {
            query = 'table_schema = database() AND table_name = ' + this.quoteIdentAsLiteral(table);
            return query;
        }
    };
    MysqlMetaQuery.prototype.buildTableQuery = function () {
        return 'SELECT table_name FROM information_schema.tables WHERE table_schema = database() ORDER BY table_name';
    };
    MysqlMetaQuery.prototype.buildColumnQuery = function (type) {
        var query = 'SELECT column_name FROM information_schema.columns WHERE ';
        query += this.buildTableConstraint(this.target.table);
        switch (type) {
            case 'time': {
                query += " AND data_type IN ('timestamp','datetime','bigint','int','double','float')";
                break;
            }
            case 'metric': {
                query += " AND data_type IN ('text','tinytext','mediumtext','longtext','varchar','char')";
                break;
            }
            case 'value': {
                query += " AND data_type IN ('bigint','int','smallint','mediumint','tinyint','double','decimal','float')";
                query += ' AND column_name <> ' + this.quoteIdentAsLiteral(this.target.timeColumn);
                break;
            }
            case 'group': {
                query += " AND data_type IN ('text','tinytext','mediumtext','longtext','varchar','char')";
                break;
            }
        }
        query += ' ORDER BY column_name';
        return query;
    };
    MysqlMetaQuery.prototype.buildValueQuery = function (column) {
        var query = 'SELECT DISTINCT QUOTE(' + column + ')';
        query += ' FROM ' + this.target.table;
        query += ' WHERE $__timeFilter(' + this.target.timeColumn + ')';
        query += ' ORDER BY 1 LIMIT 100';
        return query;
    };
    MysqlMetaQuery.prototype.buildDatatypeQuery = function (column) {
        var query = "\nSELECT data_type\nFROM information_schema.columns\nWHERE ";
        query += ' table_name = ' + this.quoteIdentAsLiteral(this.target.table);
        query += ' AND column_name = ' + this.quoteIdentAsLiteral(column);
        return query;
    };
    return MysqlMetaQuery;
}());
export { MysqlMetaQuery };
//# sourceMappingURL=meta_query.js.map
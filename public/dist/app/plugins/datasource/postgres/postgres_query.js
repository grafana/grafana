import * as tslib_1 from "tslib";
import _ from 'lodash';
var PostgresQuery = /** @class */ (function () {
    /** @ngInject */
    function PostgresQuery(target, templateSrv, scopedVars) {
        this.target = target;
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
        target.format = target.format || 'time_series';
        target.timeColumn = target.timeColumn || 'time';
        target.metricColumn = target.metricColumn || 'none';
        target.group = target.group || [];
        target.where = target.where || [{ type: 'macro', name: '$__timeFilter', params: [] }];
        target.select = target.select || [[{ type: 'column', params: ['value'] }]];
        // handle pre query gui panels gracefully
        if (!('rawQuery' in this.target)) {
            if ('rawSql' in target) {
                // pre query gui panel
                target.rawQuery = true;
            }
            else {
                // new panel
                target.rawQuery = false;
            }
        }
        // give interpolateQueryStr access to this
        this.interpolateQueryStr = this.interpolateQueryStr.bind(this);
    }
    // remove identifier quoting from identifier to use in metadata queries
    PostgresQuery.prototype.unquoteIdentifier = function (value) {
        if (value[0] === '"' && value[value.length - 1] === '"') {
            return value.substring(1, value.length - 1).replace(/""/g, '"');
        }
        else {
            return value;
        }
    };
    PostgresQuery.prototype.quoteIdentifier = function (value) {
        return '"' + String(value).replace(/"/g, '""') + '"';
    };
    PostgresQuery.prototype.quoteLiteral = function (value) {
        return "'" + String(value).replace(/'/g, "''") + "'";
    };
    PostgresQuery.prototype.escapeLiteral = function (value) {
        return String(value).replace(/'/g, "''");
    };
    PostgresQuery.prototype.hasTimeGroup = function () {
        return _.find(this.target.group, function (g) { return g.type === 'time'; });
    };
    PostgresQuery.prototype.hasMetricColumn = function () {
        return this.target.metricColumn !== 'none';
    };
    PostgresQuery.prototype.interpolateQueryStr = function (value, variable, defaultFormatFn) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return this.escapeLiteral(value);
        }
        if (typeof value === 'string') {
            return this.quoteLiteral(value);
        }
        var escapedValues = _.map(value, this.quoteLiteral);
        return escapedValues.join(',');
    };
    PostgresQuery.prototype.render = function (interpolate) {
        var target = this.target;
        // new query with no table set yet
        if (!this.target.rawQuery && !('table' in this.target)) {
            return '';
        }
        if (!target.rawQuery) {
            target.rawSql = this.buildQuery();
        }
        if (interpolate) {
            return this.templateSrv.replace(target.rawSql, this.scopedVars, this.interpolateQueryStr);
        }
        else {
            return target.rawSql;
        }
    };
    PostgresQuery.prototype.hasUnixEpochTimecolumn = function () {
        return ['int4', 'int8', 'float4', 'float8', 'numeric'].indexOf(this.target.timeColumnType) > -1;
    };
    PostgresQuery.prototype.buildTimeColumn = function (alias) {
        if (alias === void 0) { alias = true; }
        var timeGroup = this.hasTimeGroup();
        var query;
        var macro = '$__timeGroup';
        if (timeGroup) {
            var args = void 0;
            if (timeGroup.params.length > 1 && timeGroup.params[1] !== 'none') {
                args = timeGroup.params.join(',');
            }
            else {
                args = timeGroup.params[0];
            }
            if (this.hasUnixEpochTimecolumn()) {
                macro = '$__unixEpochGroup';
            }
            if (alias) {
                macro += 'Alias';
            }
            query = macro + '(' + this.target.timeColumn + ',' + args + ')';
        }
        else {
            query = this.target.timeColumn;
            if (alias) {
                query += ' AS "time"';
            }
        }
        return query;
    };
    PostgresQuery.prototype.buildMetricColumn = function () {
        if (this.hasMetricColumn()) {
            return this.target.metricColumn + ' AS metric';
        }
        return '';
    };
    PostgresQuery.prototype.buildValueColumns = function () {
        var e_1, _a;
        var query = '';
        try {
            for (var _b = tslib_1.__values(this.target.select), _c = _b.next(); !_c.done; _c = _b.next()) {
                var column = _c.value;
                query += ',\n  ' + this.buildValueColumn(column);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return query;
    };
    PostgresQuery.prototype.buildValueColumn = function (column) {
        var query = '';
        var columnName = _.find(column, function (g) { return g.type === 'column'; });
        query = columnName.params[0];
        var aggregate = _.find(column, function (g) { return g.type === 'aggregate' || g.type === 'percentile'; });
        var windows = _.find(column, function (g) { return g.type === 'window' || g.type === 'moving_window'; });
        if (aggregate) {
            var func = aggregate.params[0];
            switch (aggregate.type) {
                case 'aggregate':
                    if (func === 'first' || func === 'last') {
                        query = func + '(' + query + ',' + this.target.timeColumn + ')';
                    }
                    else {
                        query = func + '(' + query + ')';
                    }
                    break;
                case 'percentile':
                    query = func + '(' + aggregate.params[1] + ') WITHIN GROUP (ORDER BY ' + query + ')';
                    break;
            }
        }
        if (windows) {
            var overParts = [];
            if (this.hasMetricColumn()) {
                overParts.push('PARTITION BY ' + this.target.metricColumn);
            }
            overParts.push('ORDER BY ' + this.buildTimeColumn(false));
            var over = overParts.join(' ');
            var curr = void 0;
            var prev = void 0;
            switch (windows.type) {
                case 'window':
                    switch (windows.params[0]) {
                        case 'delta':
                            curr = query;
                            prev = 'lag(' + curr + ') OVER (' + over + ')';
                            query = curr + ' - ' + prev;
                            break;
                        case 'increase':
                            curr = query;
                            prev = 'lag(' + curr + ') OVER (' + over + ')';
                            query = '(CASE WHEN ' + curr + ' >= ' + prev + ' THEN ' + curr + ' - ' + prev;
                            query += ' WHEN ' + prev + ' IS NULL THEN NULL ELSE ' + curr + ' END)';
                            break;
                        case 'rate':
                            var timeColumn = this.target.timeColumn;
                            if (aggregate) {
                                timeColumn = 'min(' + timeColumn + ')';
                            }
                            curr = query;
                            prev = 'lag(' + curr + ') OVER (' + over + ')';
                            query = '(CASE WHEN ' + curr + ' >= ' + prev + ' THEN ' + curr + ' - ' + prev;
                            query += ' WHEN ' + prev + ' IS NULL THEN NULL ELSE ' + curr + ' END)';
                            query += '/extract(epoch from ' + timeColumn + ' - lag(' + timeColumn + ') OVER (' + over + '))';
                            break;
                        default:
                            query = windows.params[0] + '(' + query + ') OVER (' + over + ')';
                            break;
                    }
                    break;
                case 'moving_window':
                    query = windows.params[0] + '(' + query + ') OVER (' + over + ' ROWS ' + windows.params[1] + ' PRECEDING)';
                    break;
            }
        }
        var alias = _.find(column, function (g) { return g.type === 'alias'; });
        if (alias) {
            query += ' AS ' + this.quoteIdentifier(alias.params[0]);
        }
        return query;
    };
    PostgresQuery.prototype.buildWhereClause = function () {
        var _this = this;
        var query = '';
        var conditions = _.map(this.target.where, function (tag, index) {
            switch (tag.type) {
                case 'macro':
                    return tag.name + '(' + _this.target.timeColumn + ')';
                    break;
                case 'expression':
                    return tag.params.join(' ');
                    break;
            }
        });
        if (conditions.length > 0) {
            query = '\nWHERE\n  ' + conditions.join(' AND\n  ');
        }
        return query;
    };
    PostgresQuery.prototype.buildGroupClause = function () {
        var query = '';
        var groupSection = '';
        for (var i = 0; i < this.target.group.length; i++) {
            var part = this.target.group[i];
            if (i > 0) {
                groupSection += ', ';
            }
            if (part.type === 'time') {
                groupSection += '1';
            }
            else {
                groupSection += part.params[0];
            }
        }
        if (groupSection.length) {
            query = '\nGROUP BY ' + groupSection;
            if (this.hasMetricColumn()) {
                query += ',2';
            }
        }
        return query;
    };
    PostgresQuery.prototype.buildQuery = function () {
        var query = 'SELECT';
        query += '\n  ' + this.buildTimeColumn();
        if (this.hasMetricColumn()) {
            query += ',\n  ' + this.buildMetricColumn();
        }
        query += this.buildValueColumns();
        query += '\nFROM ' + this.target.table;
        query += this.buildWhereClause();
        query += this.buildGroupClause();
        query += '\nORDER BY 1';
        if (this.hasMetricColumn()) {
            query += ',2';
        }
        return query;
    };
    return PostgresQuery;
}());
export default PostgresQuery;
//# sourceMappingURL=postgres_query.js.map
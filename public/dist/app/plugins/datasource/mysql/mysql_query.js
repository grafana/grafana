import * as tslib_1 from "tslib";
import _ from 'lodash';
var MysqlQuery = /** @class */ (function () {
    /** @ngInject */
    function MysqlQuery(target, templateSrv, scopedVars) {
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
    MysqlQuery.prototype.unquoteIdentifier = function (value) {
        if (value[0] === '"' && value[value.length - 1] === '"') {
            return value.substring(1, value.length - 1).replace(/""/g, '"');
        }
        else {
            return value;
        }
    };
    MysqlQuery.prototype.quoteIdentifier = function (value) {
        return '"' + value.replace(/"/g, '""') + '"';
    };
    MysqlQuery.prototype.quoteLiteral = function (value) {
        return "'" + value.replace(/'/g, "''") + "'";
    };
    MysqlQuery.prototype.escapeLiteral = function (value) {
        return String(value).replace(/'/g, "''");
    };
    MysqlQuery.prototype.hasTimeGroup = function () {
        return _.find(this.target.group, function (g) { return g.type === 'time'; });
    };
    MysqlQuery.prototype.hasMetricColumn = function () {
        return this.target.metricColumn !== 'none';
    };
    MysqlQuery.prototype.interpolateQueryStr = function (value, variable, defaultFormatFn) {
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
    MysqlQuery.prototype.render = function (interpolate) {
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
    MysqlQuery.prototype.hasUnixEpochTimecolumn = function () {
        return ['int', 'bigint', 'double'].indexOf(this.target.timeColumnType) > -1;
    };
    MysqlQuery.prototype.buildTimeColumn = function (alias) {
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
    MysqlQuery.prototype.buildMetricColumn = function () {
        if (this.hasMetricColumn()) {
            return this.target.metricColumn + ' AS metric';
        }
        return '';
    };
    MysqlQuery.prototype.buildValueColumns = function () {
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
    MysqlQuery.prototype.buildValueColumn = function (column) {
        var query = '';
        var columnName = _.find(column, function (g) { return g.type === 'column'; });
        query = columnName.params[0];
        var aggregate = _.find(column, function (g) { return g.type === 'aggregate'; });
        if (aggregate) {
            var func = aggregate.params[0];
            query = func + '(' + query + ')';
        }
        var alias = _.find(column, function (g) { return g.type === 'alias'; });
        if (alias) {
            query += ' AS ' + this.quoteIdentifier(alias.params[0]);
        }
        return query;
    };
    MysqlQuery.prototype.buildWhereClause = function () {
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
    MysqlQuery.prototype.buildGroupClause = function () {
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
    MysqlQuery.prototype.buildQuery = function () {
        var query = 'SELECT';
        query += '\n  ' + this.buildTimeColumn();
        if (this.hasMetricColumn()) {
            query += ',\n  ' + this.buildMetricColumn();
        }
        query += this.buildValueColumns();
        query += '\nFROM ' + this.target.table;
        query += this.buildWhereClause();
        query += this.buildGroupClause();
        query += '\nORDER BY ' + this.buildTimeColumn(false);
        return query;
    };
    return MysqlQuery;
}());
export default MysqlQuery;
//# sourceMappingURL=mysql_query.js.map
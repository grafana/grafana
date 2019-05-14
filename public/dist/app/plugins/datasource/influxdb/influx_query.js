import _ from 'lodash';
import queryPart from './query_part';
import kbn from 'app/core/utils/kbn';
var InfluxQuery = /** @class */ (function () {
    /** @ngInject */
    function InfluxQuery(target, templateSrv, scopedVars) {
        this.target = target;
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
        target.policy = target.policy || 'default';
        target.resultFormat = target.resultFormat || 'time_series';
        target.orderByTime = target.orderByTime || 'ASC';
        target.tags = target.tags || [];
        target.groupBy = target.groupBy || [{ type: 'time', params: ['$__interval'] }, { type: 'fill', params: ['null'] }];
        target.select = target.select || [[{ type: 'field', params: ['value'] }, { type: 'mean', params: [] }]];
        this.updateProjection();
    }
    InfluxQuery.prototype.updateProjection = function () {
        this.selectModels = _.map(this.target.select, function (parts) {
            return _.map(parts, queryPart.create);
        });
        this.groupByParts = _.map(this.target.groupBy, queryPart.create);
    };
    InfluxQuery.prototype.updatePersistedParts = function () {
        this.target.select = _.map(this.selectModels, function (selectParts) {
            return _.map(selectParts, function (part) {
                return { type: part.def.type, params: part.params };
            });
        });
    };
    InfluxQuery.prototype.hasGroupByTime = function () {
        return _.find(this.target.groupBy, function (g) { return g.type === 'time'; });
    };
    InfluxQuery.prototype.hasFill = function () {
        return _.find(this.target.groupBy, function (g) { return g.type === 'fill'; });
    };
    InfluxQuery.prototype.addGroupBy = function (value) {
        var stringParts = value.match(/^(\w+)\((.*)\)$/);
        var typePart = stringParts[1];
        var arg = stringParts[2];
        var partModel = queryPart.create({ type: typePart, params: [arg] });
        var partCount = this.target.groupBy.length;
        if (partCount === 0) {
            this.target.groupBy.push(partModel.part);
        }
        else if (typePart === 'time') {
            this.target.groupBy.splice(0, 0, partModel.part);
        }
        else if (typePart === 'tag') {
            if (this.target.groupBy[partCount - 1].type === 'fill') {
                this.target.groupBy.splice(partCount - 1, 0, partModel.part);
            }
            else {
                this.target.groupBy.push(partModel.part);
            }
        }
        else {
            this.target.groupBy.push(partModel.part);
        }
        this.updateProjection();
    };
    InfluxQuery.prototype.removeGroupByPart = function (part, index) {
        var categories = queryPart.getCategories();
        if (part.def.type === 'time') {
            // remove fill
            this.target.groupBy = _.filter(this.target.groupBy, function (g) { return g.type !== 'fill'; });
            // remove aggregations
            this.target.select = _.map(this.target.select, function (s) {
                return _.filter(s, function (part) {
                    var partModel = queryPart.create(part);
                    if (partModel.def.category === categories.Aggregations) {
                        return false;
                    }
                    if (partModel.def.category === categories.Selectors) {
                        return false;
                    }
                    return true;
                });
            });
        }
        this.target.groupBy.splice(index, 1);
        this.updateProjection();
    };
    InfluxQuery.prototype.removeSelect = function (index) {
        this.target.select.splice(index, 1);
        this.updateProjection();
    };
    InfluxQuery.prototype.removeSelectPart = function (selectParts, part) {
        // if we remove the field remove the whole statement
        if (part.def.type === 'field') {
            if (this.selectModels.length > 1) {
                var modelsIndex = _.indexOf(this.selectModels, selectParts);
                this.selectModels.splice(modelsIndex, 1);
            }
        }
        else {
            var partIndex = _.indexOf(selectParts, part);
            selectParts.splice(partIndex, 1);
        }
        this.updatePersistedParts();
    };
    InfluxQuery.prototype.addSelectPart = function (selectParts, type) {
        var partModel = queryPart.create({ type: type });
        partModel.def.addStrategy(selectParts, partModel, this);
        this.updatePersistedParts();
    };
    InfluxQuery.prototype.renderTagCondition = function (tag, index, interpolate) {
        var str = '';
        var operator = tag.operator;
        var value = tag.value;
        if (index > 0) {
            str = (tag.condition || 'AND') + ' ';
        }
        if (!operator) {
            if (/^\/.*\/$/.test(value)) {
                operator = '=~';
            }
            else {
                operator = '=';
            }
        }
        // quote value unless regex
        if (operator !== '=~' && operator !== '!~') {
            if (interpolate) {
                value = this.templateSrv.replace(value, this.scopedVars);
            }
            if (operator !== '>' && operator !== '<') {
                value = "'" + value.replace(/\\/g, '\\\\') + "'";
            }
        }
        else if (interpolate) {
            value = this.templateSrv.replace(value, this.scopedVars, 'regex');
        }
        return str + '"' + tag.key + '" ' + operator + ' ' + value;
    };
    InfluxQuery.prototype.getMeasurementAndPolicy = function (interpolate) {
        var policy = this.target.policy;
        var measurement = this.target.measurement || 'measurement';
        if (!measurement.match('^/.*/$')) {
            measurement = '"' + measurement + '"';
        }
        else if (interpolate) {
            measurement = this.templateSrv.replace(measurement, this.scopedVars, 'regex');
        }
        if (policy !== 'default') {
            policy = '"' + this.target.policy + '".';
        }
        else {
            policy = '';
        }
        return policy + measurement;
    };
    InfluxQuery.prototype.interpolateQueryStr = function (value, variable, defaultFormatFn) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return value;
        }
        if (typeof value === 'string') {
            return kbn.regexEscape(value);
        }
        var escapedValues = _.map(value, kbn.regexEscape);
        return '(' + escapedValues.join('|') + ')';
    };
    InfluxQuery.prototype.render = function (interpolate) {
        var _this = this;
        var target = this.target;
        if (target.rawQuery) {
            if (interpolate) {
                return this.templateSrv.replace(target.query, this.scopedVars, this.interpolateQueryStr);
            }
            else {
                return target.query;
            }
        }
        var query = 'SELECT ';
        var i, y;
        for (i = 0; i < this.selectModels.length; i++) {
            var parts = this.selectModels[i];
            var selectText = '';
            for (y = 0; y < parts.length; y++) {
                var part = parts[y];
                selectText = part.render(selectText);
            }
            if (i > 0) {
                query += ', ';
            }
            query += selectText;
        }
        query += ' FROM ' + this.getMeasurementAndPolicy(interpolate) + ' WHERE ';
        var conditions = _.map(target.tags, function (tag, index) {
            return _this.renderTagCondition(tag, index, interpolate);
        });
        if (conditions.length > 0) {
            query += '(' + conditions.join(' ') + ') AND ';
        }
        query += '$timeFilter';
        var groupBySection = '';
        for (i = 0; i < this.groupByParts.length; i++) {
            var part = this.groupByParts[i];
            if (i > 0) {
                // for some reason fill has no separator
                groupBySection += part.def.type === 'fill' ? ' ' : ', ';
            }
            groupBySection += part.render('');
        }
        if (groupBySection.length) {
            query += ' GROUP BY ' + groupBySection;
        }
        if (target.fill) {
            query += ' fill(' + target.fill + ')';
        }
        if (target.orderByTime === 'DESC') {
            query += ' ORDER BY time DESC';
        }
        if (target.limit) {
            query += ' LIMIT ' + target.limit;
        }
        if (target.slimit) {
            query += ' SLIMIT ' + target.slimit;
        }
        if (target.tz) {
            query += " tz('" + target.tz + "')";
        }
        return query;
    };
    InfluxQuery.prototype.renderAdhocFilters = function (filters) {
        var _this = this;
        var conditions = _.map(filters, function (tag, index) {
            return _this.renderTagCondition(tag, index, false);
        });
        return conditions.join(' ');
    };
    return InfluxQuery;
}());
export default InfluxQuery;
//# sourceMappingURL=influx_query.js.map
import { map, find, filter, indexOf } from 'lodash';
import queryPart from './query_part';
import kbn from 'app/core/utils/kbn';
var InfluxQueryModel = /** @class */ (function () {
    /** @ngInject */
    function InfluxQueryModel(target, templateSrv, scopedVars) {
        this.selectModels = [];
        this.target = target;
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
        target.policy = target.policy || 'default';
        target.resultFormat = target.resultFormat || 'time_series';
        target.orderByTime = target.orderByTime || 'ASC';
        target.tags = target.tags || [];
        target.groupBy = target.groupBy || [
            { type: 'time', params: ['$__interval'] },
            { type: 'fill', params: ['null'] },
        ];
        target.select = target.select || [
            [
                { type: 'field', params: ['value'] },
                { type: 'mean', params: [] },
            ],
        ];
        this.updateProjection();
    }
    InfluxQueryModel.prototype.updateProjection = function () {
        this.selectModels = map(this.target.select, function (parts) {
            return map(parts, queryPart.create);
        });
        this.groupByParts = map(this.target.groupBy, queryPart.create);
    };
    InfluxQueryModel.prototype.updatePersistedParts = function () {
        this.target.select = map(this.selectModels, function (selectParts) {
            return map(selectParts, function (part) {
                return { type: part.def.type, params: part.params };
            });
        });
    };
    InfluxQueryModel.prototype.hasGroupByTime = function () {
        return find(this.target.groupBy, function (g) { return g.type === 'time'; });
    };
    InfluxQueryModel.prototype.hasFill = function () {
        return find(this.target.groupBy, function (g) { return g.type === 'fill'; });
    };
    InfluxQueryModel.prototype.addGroupBy = function (value) {
        var stringParts = value.match(/^(\w+)\((.*)\)$/);
        if (!stringParts || !this.target.groupBy) {
            return;
        }
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
    InfluxQueryModel.prototype.removeGroupByPart = function (part, index) {
        var categories = queryPart.getCategories();
        if (part.def.type === 'time') {
            // remove fill
            this.target.groupBy = filter(this.target.groupBy, function (g) { return g.type !== 'fill'; });
            // remove aggregations
            this.target.select = map(this.target.select, function (s) {
                return filter(s, function (part) {
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
    InfluxQueryModel.prototype.removeSelect = function (index) {
        this.target.select.splice(index, 1);
        this.updateProjection();
    };
    InfluxQueryModel.prototype.removeSelectPart = function (selectParts, part) {
        // if we remove the field remove the whole statement
        if (part.def.type === 'field') {
            if (this.selectModels.length > 1) {
                var modelsIndex = indexOf(this.selectModels, selectParts);
                this.selectModels.splice(modelsIndex, 1);
            }
        }
        else {
            var partIndex = indexOf(selectParts, part);
            selectParts.splice(partIndex, 1);
        }
        this.updatePersistedParts();
    };
    InfluxQueryModel.prototype.addSelectPart = function (selectParts, type) {
        var partModel = queryPart.create({ type: type });
        partModel.def.addStrategy(selectParts, partModel, this);
        this.updatePersistedParts();
    };
    InfluxQueryModel.prototype.renderTagCondition = function (tag, index, interpolate) {
        // FIXME: merge this function with query_builder/renderTagCondition
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
                value = "'" + value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + "'";
            }
        }
        else if (interpolate) {
            value = this.templateSrv.replace(value, this.scopedVars, 'regex');
        }
        return str + '"' + tag.key + '" ' + operator + ' ' + value;
    };
    InfluxQueryModel.prototype.getMeasurementAndPolicy = function (interpolate) {
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
    InfluxQueryModel.prototype.interpolateQueryStr = function (value, variable, defaultFormatFn) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return value;
        }
        if (typeof value === 'string') {
            return kbn.regexEscape(value);
        }
        var escapedValues = map(value, kbn.regexEscape);
        return '(' + escapedValues.join('|') + ')';
    };
    InfluxQueryModel.prototype.render = function (interpolate) {
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
        var conditions = map(target.tags, function (tag, index) {
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
    InfluxQueryModel.prototype.renderAdhocFilters = function (filters) {
        var _this = this;
        var conditions = map(filters, function (tag, index) {
            return _this.renderTagCondition(tag, index, true);
        });
        return conditions.join(' ');
    };
    return InfluxQueryModel;
}());
export default InfluxQueryModel;
//# sourceMappingURL=influx_query_model.js.map
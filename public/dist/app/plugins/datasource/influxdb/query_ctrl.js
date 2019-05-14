import * as tslib_1 from "tslib";
import angular from 'angular';
import _ from 'lodash';
import { InfluxQueryBuilder } from './query_builder';
import InfluxQuery from './influx_query';
import queryPart from './query_part';
import { QueryCtrl } from 'app/plugins/sdk';
var InfluxQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(InfluxQueryCtrl, _super);
    /** @ngInject */
    function InfluxQueryCtrl($scope, $injector, templateSrv, $q, uiSegmentSrv) {
        var e_1, _a;
        var _this = _super.call(this, $scope, $injector) || this;
        _this.templateSrv = templateSrv;
        _this.$q = $q;
        _this.uiSegmentSrv = uiSegmentSrv;
        _this.target = _this.target;
        _this.queryModel = new InfluxQuery(_this.target, templateSrv, _this.panel.scopedVars);
        _this.queryBuilder = new InfluxQueryBuilder(_this.target, _this.datasource.database);
        _this.groupBySegment = _this.uiSegmentSrv.newPlusButton();
        _this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
        _this.policySegment = uiSegmentSrv.newSegment(_this.target.policy);
        if (!_this.target.measurement) {
            _this.measurementSegment = uiSegmentSrv.newSelectMeasurement();
        }
        else {
            _this.measurementSegment = uiSegmentSrv.newSegment(_this.target.measurement);
        }
        _this.tagSegments = [];
        try {
            for (var _b = tslib_1.__values(_this.target.tags), _c = _b.next(); !_c.done; _c = _b.next()) {
                var tag = _c.value;
                if (!tag.operator) {
                    if (/^\/.*\/$/.test(tag.value)) {
                        tag.operator = '=~';
                    }
                    else {
                        tag.operator = '=';
                    }
                }
                if (tag.condition) {
                    _this.tagSegments.push(uiSegmentSrv.newCondition(tag.condition));
                }
                _this.tagSegments.push(uiSegmentSrv.newKey(tag.key));
                _this.tagSegments.push(uiSegmentSrv.newOperator(tag.operator));
                _this.tagSegments.push(uiSegmentSrv.newKeyValue(tag.value));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        _this.fixTagSegments();
        _this.buildSelectMenu();
        _this.removeTagFilterSegment = uiSegmentSrv.newSegment({
            fake: true,
            value: '-- remove tag filter --',
        });
        return _this;
    }
    InfluxQueryCtrl.prototype.removeOrderByTime = function () {
        this.target.orderByTime = 'ASC';
    };
    InfluxQueryCtrl.prototype.buildSelectMenu = function () {
        var categories = queryPart.getCategories();
        this.selectMenu = _.reduce(categories, function (memo, cat, key) {
            var menu = {
                text: key,
                submenu: cat.map(function (item) {
                    return { text: item.type, value: item.type };
                }),
            };
            memo.push(menu);
            return memo;
        }, []);
    };
    InfluxQueryCtrl.prototype.getGroupByOptions = function () {
        var _this = this;
        var query = this.queryBuilder.buildExploreQuery('TAG_KEYS');
        return this.datasource
            .metricFindQuery(query)
            .then(function (tags) {
            var e_2, _a;
            var options = [];
            if (!_this.queryModel.hasFill()) {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'fill(null)' }));
            }
            if (!_this.target.limit) {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'LIMIT' }));
            }
            if (!_this.target.slimit) {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'SLIMIT' }));
            }
            if (!_this.target.tz) {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'tz' }));
            }
            if (_this.target.orderByTime === 'ASC') {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'ORDER BY time DESC' }));
            }
            if (!_this.queryModel.hasGroupByTime()) {
                options.push(_this.uiSegmentSrv.newSegment({ value: 'time($interval)' }));
            }
            try {
                for (var tags_1 = tslib_1.__values(tags), tags_1_1 = tags_1.next(); !tags_1_1.done; tags_1_1 = tags_1.next()) {
                    var tag = tags_1_1.value;
                    options.push(_this.uiSegmentSrv.newSegment({ value: 'tag(' + tag.text + ')' }));
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (tags_1_1 && !tags_1_1.done && (_a = tags_1.return)) _a.call(tags_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return options;
        })
            .catch(this.handleQueryError.bind(this));
    };
    InfluxQueryCtrl.prototype.groupByAction = function () {
        switch (this.groupBySegment.value) {
            case 'LIMIT': {
                this.target.limit = 10;
                break;
            }
            case 'SLIMIT': {
                this.target.slimit = 10;
                break;
            }
            case 'tz': {
                this.target.tz = 'UTC';
                break;
            }
            case 'ORDER BY time DESC': {
                this.target.orderByTime = 'DESC';
                break;
            }
            default: {
                this.queryModel.addGroupBy(this.groupBySegment.value);
            }
        }
        var plusButton = this.uiSegmentSrv.newPlusButton();
        this.groupBySegment.value = plusButton.value;
        this.groupBySegment.html = plusButton.html;
        this.panelCtrl.refresh();
    };
    InfluxQueryCtrl.prototype.addSelectPart = function (selectParts, cat, subitem) {
        this.queryModel.addSelectPart(selectParts, subitem.value);
        this.panelCtrl.refresh();
    };
    InfluxQueryCtrl.prototype.handleSelectPartEvent = function (selectParts, part, evt) {
        switch (evt.name) {
            case 'get-param-options': {
                var fieldsQuery = this.queryBuilder.buildExploreQuery('FIELDS');
                return this.datasource
                    .metricFindQuery(fieldsQuery)
                    .then(this.transformToSegments(true))
                    .catch(this.handleQueryError.bind(this));
            }
            case 'part-param-changed': {
                this.panelCtrl.refresh();
                break;
            }
            case 'action': {
                this.queryModel.removeSelectPart(selectParts, part);
                this.panelCtrl.refresh();
                break;
            }
            case 'get-part-actions': {
                return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
            }
        }
    };
    InfluxQueryCtrl.prototype.handleGroupByPartEvent = function (part, index, evt) {
        switch (evt.name) {
            case 'get-param-options': {
                var tagsQuery = this.queryBuilder.buildExploreQuery('TAG_KEYS');
                return this.datasource
                    .metricFindQuery(tagsQuery)
                    .then(this.transformToSegments(true))
                    .catch(this.handleQueryError.bind(this));
            }
            case 'part-param-changed': {
                this.panelCtrl.refresh();
                break;
            }
            case 'action': {
                this.queryModel.removeGroupByPart(part, index);
                this.panelCtrl.refresh();
                break;
            }
            case 'get-part-actions': {
                return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
            }
        }
    };
    InfluxQueryCtrl.prototype.fixTagSegments = function () {
        var count = this.tagSegments.length;
        var lastSegment = this.tagSegments[Math.max(count - 1, 0)];
        if (!lastSegment || lastSegment.type !== 'plus-button') {
            this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
        }
    };
    InfluxQueryCtrl.prototype.measurementChanged = function () {
        this.target.measurement = this.measurementSegment.value;
        this.panelCtrl.refresh();
    };
    InfluxQueryCtrl.prototype.getPolicySegments = function () {
        var policiesQuery = this.queryBuilder.buildExploreQuery('RETENTION POLICIES');
        return this.datasource
            .metricFindQuery(policiesQuery)
            .then(this.transformToSegments(false))
            .catch(this.handleQueryError.bind(this));
    };
    InfluxQueryCtrl.prototype.policyChanged = function () {
        this.target.policy = this.policySegment.value;
        this.panelCtrl.refresh();
    };
    InfluxQueryCtrl.prototype.toggleEditorMode = function () {
        try {
            this.target.query = this.queryModel.render(false);
        }
        catch (err) {
            console.log('query render error');
        }
        this.target.rawQuery = !this.target.rawQuery;
    };
    InfluxQueryCtrl.prototype.getMeasurements = function (measurementFilter) {
        var query = this.queryBuilder.buildExploreQuery('MEASUREMENTS', undefined, measurementFilter);
        return this.datasource
            .metricFindQuery(query)
            .then(this.transformToSegments(true))
            .catch(this.handleQueryError.bind(this));
    };
    InfluxQueryCtrl.prototype.handleQueryError = function (err) {
        this.error = err.message || 'Failed to issue metric query';
        return [];
    };
    InfluxQueryCtrl.prototype.transformToSegments = function (addTemplateVars) {
        var _this = this;
        return function (results) {
            var e_3, _a;
            var segments = _.map(results, function (segment) {
                return _this.uiSegmentSrv.newSegment({
                    value: segment.text,
                    expandable: segment.expandable,
                });
            });
            if (addTemplateVars) {
                try {
                    for (var _b = tslib_1.__values(_this.templateSrv.variables), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var variable = _c.value;
                        segments.unshift(_this.uiSegmentSrv.newSegment({
                            type: 'value',
                            value: '/^$' + variable.name + '$/',
                            expandable: true,
                        }));
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
            return segments;
        };
    };
    InfluxQueryCtrl.prototype.getTagsOrValues = function (segment, index) {
        var _this = this;
        if (segment.type === 'condition') {
            return this.$q.when([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
        }
        if (segment.type === 'operator') {
            var nextValue = this.tagSegments[index + 1].value;
            if (/^\/.*\/$/.test(nextValue)) {
                return this.$q.when(this.uiSegmentSrv.newOperators(['=~', '!~']));
            }
            else {
                return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<>', '<', '>']));
            }
        }
        var query, addTemplateVars;
        if (segment.type === 'key' || segment.type === 'plus-button') {
            query = this.queryBuilder.buildExploreQuery('TAG_KEYS');
            addTemplateVars = false;
        }
        else if (segment.type === 'value') {
            query = this.queryBuilder.buildExploreQuery('TAG_VALUES', this.tagSegments[index - 2].value);
            addTemplateVars = true;
        }
        return this.datasource
            .metricFindQuery(query)
            .then(this.transformToSegments(addTemplateVars))
            .then(function (results) {
            if (segment.type === 'key') {
                results.splice(0, 0, angular.copy(_this.removeTagFilterSegment));
            }
            return results;
        })
            .catch(this.handleQueryError.bind(this));
    };
    InfluxQueryCtrl.prototype.getFieldSegments = function () {
        var fieldsQuery = this.queryBuilder.buildExploreQuery('FIELDS');
        return this.datasource
            .metricFindQuery(fieldsQuery)
            .then(this.transformToSegments(false))
            .catch(this.handleQueryError);
    };
    InfluxQueryCtrl.prototype.tagSegmentUpdated = function (segment, index) {
        this.tagSegments[index] = segment;
        // handle remove tag condition
        if (segment.value === this.removeTagFilterSegment.value) {
            this.tagSegments.splice(index, 3);
            if (this.tagSegments.length === 0) {
                this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
            }
            else if (this.tagSegments.length > 2) {
                this.tagSegments.splice(Math.max(index - 1, 0), 1);
                if (this.tagSegments[this.tagSegments.length - 1].type !== 'plus-button') {
                    this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
                }
            }
        }
        else {
            if (segment.type === 'plus-button') {
                if (index > 2) {
                    this.tagSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
                }
                this.tagSegments.push(this.uiSegmentSrv.newOperator('='));
                this.tagSegments.push(this.uiSegmentSrv.newFake('select tag value', 'value', 'query-segment-value'));
                segment.type = 'key';
                segment.cssClass = 'query-segment-key';
            }
            if (index + 1 === this.tagSegments.length) {
                this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
            }
        }
        this.rebuildTargetTagConditions();
    };
    InfluxQueryCtrl.prototype.rebuildTargetTagConditions = function () {
        var _this = this;
        var tags = [];
        var tagIndex = 0;
        var tagOperator = '';
        _.each(this.tagSegments, function (segment2, index) {
            if (segment2.type === 'key') {
                if (tags.length === 0) {
                    tags.push({});
                }
                tags[tagIndex].key = segment2.value;
            }
            else if (segment2.type === 'value') {
                tagOperator = _this.getTagValueOperator(segment2.value, tags[tagIndex].operator);
                if (tagOperator) {
                    _this.tagSegments[index - 1] = _this.uiSegmentSrv.newOperator(tagOperator);
                    tags[tagIndex].operator = tagOperator;
                }
                tags[tagIndex].value = segment2.value;
            }
            else if (segment2.type === 'condition') {
                tags.push({ condition: segment2.value });
                tagIndex += 1;
            }
            else if (segment2.type === 'operator') {
                tags[tagIndex].operator = segment2.value;
            }
        });
        this.target.tags = tags;
        this.panelCtrl.refresh();
    };
    InfluxQueryCtrl.prototype.getTagValueOperator = function (tagValue, tagOperator) {
        if (tagOperator !== '=~' && tagOperator !== '!~' && /^\/.*\/$/.test(tagValue)) {
            return '=~';
        }
        else if ((tagOperator === '=~' || tagOperator === '!~') && /^(?!\/.*\/$)/.test(tagValue)) {
            return '=';
        }
        return null;
    };
    InfluxQueryCtrl.prototype.getCollapsedText = function () {
        return this.queryModel.render(false);
    };
    InfluxQueryCtrl.templateUrl = 'partials/query.editor.html';
    return InfluxQueryCtrl;
}(QueryCtrl));
export { InfluxQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map
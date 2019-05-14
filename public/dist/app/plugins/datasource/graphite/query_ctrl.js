import * as tslib_1 from "tslib";
import './add_graphite_func';
import './func_editor';
import _ from 'lodash';
import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';
var GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];
var TAG_PREFIX = 'tag: ';
var GraphiteQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(GraphiteQueryCtrl, _super);
    /** @ngInject */
    function GraphiteQueryCtrl($scope, $injector, uiSegmentSrv, templateSrv, $timeout) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.uiSegmentSrv = uiSegmentSrv;
        _this.templateSrv = templateSrv;
        _this.supportsTags = _this.datasource.supportsTags;
        _this.paused = false;
        _this.target.target = _this.target.target || '';
        _this.datasource.waitForFuncDefsLoaded().then(function () {
            _this.queryModel = new GraphiteQuery(_this.datasource, _this.target, templateSrv);
            _this.buildSegments();
        });
        _this.removeTagValue = '-- remove tag --';
        return _this;
    }
    GraphiteQueryCtrl.prototype.parseTarget = function () {
        this.queryModel.parseTarget();
        this.buildSegments();
    };
    GraphiteQueryCtrl.prototype.toggleEditorMode = function () {
        this.target.textEditor = !this.target.textEditor;
        this.parseTarget();
    };
    GraphiteQueryCtrl.prototype.buildSegments = function () {
        var _this = this;
        this.segments = _.map(this.queryModel.segments, function (segment) {
            return _this.uiSegmentSrv.newSegment(segment);
        });
        var checkOtherSegmentsIndex = this.queryModel.checkOtherSegmentsIndex || 0;
        this.checkOtherSegments(checkOtherSegmentsIndex);
        if (this.queryModel.seriesByTagUsed) {
            this.fixTagSegments();
        }
    };
    GraphiteQueryCtrl.prototype.addSelectMetricSegment = function () {
        this.queryModel.addSelectMetricSegment();
        this.segments.push(this.uiSegmentSrv.newSelectMetric());
    };
    GraphiteQueryCtrl.prototype.checkOtherSegments = function (fromIndex) {
        var _this = this;
        if (this.queryModel.segments.length === 1 && this.queryModel.segments[0].type === 'series-ref') {
            return;
        }
        if (fromIndex === 0) {
            this.addSelectMetricSegment();
            return;
        }
        var path = this.queryModel.getSegmentPathUpTo(fromIndex + 1);
        if (path === '') {
            return Promise.resolve();
        }
        return this.datasource
            .metricFindQuery(path)
            .then(function (segments) {
            if (segments.length === 0) {
                if (path !== '') {
                    _this.queryModel.segments = _this.queryModel.segments.splice(0, fromIndex);
                    _this.segments = _this.segments.splice(0, fromIndex);
                    _this.addSelectMetricSegment();
                }
            }
            else if (segments[0].expandable) {
                if (_this.segments.length === fromIndex) {
                    _this.addSelectMetricSegment();
                }
                else {
                    return _this.checkOtherSegments(fromIndex + 1);
                }
            }
        })
            .catch(function (err) {
            appEvents.emit('alert-error', ['Error', err]);
        });
    };
    GraphiteQueryCtrl.prototype.setSegmentFocus = function (segmentIndex) {
        _.each(this.segments, function (segment, index) {
            segment.focus = segmentIndex === index;
        });
    };
    GraphiteQueryCtrl.prototype.getAltSegments = function (index, prefix) {
        var _this = this;
        var query = prefix && prefix.length > 0 ? '*' + prefix + '*' : '*';
        if (index > 0) {
            query = this.queryModel.getSegmentPathUpTo(index) + '.' + query;
        }
        var options = {
            range: this.panelCtrl.range,
            requestId: 'get-alt-segments',
        };
        return this.datasource
            .metricFindQuery(query, options)
            .then(function (segments) {
            var altSegments = _.map(segments, function (segment) {
                return _this.uiSegmentSrv.newSegment({
                    value: segment.text,
                    expandable: segment.expandable,
                });
            });
            if (index > 0 && altSegments.length === 0) {
                return altSegments;
            }
            // add query references
            if (index === 0) {
                _.eachRight(_this.panelCtrl.panel.targets, function (target) {
                    if (target.refId === _this.queryModel.target.refId) {
                        return;
                    }
                    altSegments.unshift(_this.uiSegmentSrv.newSegment({
                        type: 'series-ref',
                        value: '#' + target.refId,
                        expandable: false,
                    }));
                });
            }
            // add template variables
            _.eachRight(_this.templateSrv.variables, function (variable) {
                altSegments.unshift(_this.uiSegmentSrv.newSegment({
                    type: 'template',
                    value: '$' + variable.name,
                    expandable: true,
                }));
            });
            // add wildcard option
            altSegments.unshift(_this.uiSegmentSrv.newSegment('*'));
            if (_this.supportsTags && index === 0) {
                _this.removeTaggedEntry(altSegments);
                return _this.addAltTagSegments(prefix, altSegments);
            }
            else {
                return altSegments;
            }
        })
            .catch(function (err) {
            return [];
        });
    };
    GraphiteQueryCtrl.prototype.addAltTagSegments = function (prefix, altSegments) {
        return this.getTagsAsSegments(prefix).then(function (tagSegments) {
            tagSegments = _.map(tagSegments, function (segment) {
                segment.value = TAG_PREFIX + segment.value;
                return segment;
            });
            return altSegments.concat.apply(altSegments, tslib_1.__spread(tagSegments));
        });
    };
    GraphiteQueryCtrl.prototype.removeTaggedEntry = function (altSegments) {
        altSegments = _.remove(altSegments, function (s) { return s.value === '_tagged'; });
    };
    GraphiteQueryCtrl.prototype.segmentValueChanged = function (segment, segmentIndex) {
        var _this = this;
        this.error = null;
        this.queryModel.updateSegmentValue(segment, segmentIndex);
        if (this.queryModel.functions.length > 0 && this.queryModel.functions[0].def.fake) {
            this.queryModel.functions = [];
        }
        if (segment.type === 'tag') {
            var tag = removeTagPrefix(segment.value);
            this.pause();
            this.addSeriesByTagFunc(tag);
            return;
        }
        if (segment.expandable) {
            return this.checkOtherSegments(segmentIndex + 1).then(function () {
                _this.setSegmentFocus(segmentIndex + 1);
                _this.targetChanged();
            });
        }
        else {
            this.spliceSegments(segmentIndex + 1);
        }
        this.setSegmentFocus(segmentIndex + 1);
        this.targetChanged();
    };
    GraphiteQueryCtrl.prototype.spliceSegments = function (index) {
        this.segments = this.segments.splice(0, index);
        this.queryModel.segments = this.queryModel.segments.splice(0, index);
    };
    GraphiteQueryCtrl.prototype.emptySegments = function () {
        this.queryModel.segments = [];
        this.segments = [];
    };
    GraphiteQueryCtrl.prototype.targetTextChanged = function () {
        this.updateModelTarget();
        this.refresh();
    };
    GraphiteQueryCtrl.prototype.updateModelTarget = function () {
        this.queryModel.updateModelTarget(this.panelCtrl.panel.targets);
    };
    GraphiteQueryCtrl.prototype.targetChanged = function () {
        if (this.queryModel.error) {
            return;
        }
        var oldTarget = this.queryModel.target.target;
        this.updateModelTarget();
        if (this.queryModel.target !== oldTarget && !this.paused) {
            this.panelCtrl.refresh();
        }
    };
    GraphiteQueryCtrl.prototype.addFunction = function (funcDef) {
        var newFunc = this.datasource.createFuncInstance(funcDef, {
            withDefaultParams: true,
        });
        newFunc.added = true;
        this.queryModel.addFunction(newFunc);
        this.smartlyHandleNewAliasByNode(newFunc);
        if (this.segments.length === 1 && this.segments[0].fake) {
            this.emptySegments();
        }
        if (!newFunc.params.length && newFunc.added) {
            this.targetChanged();
        }
        if (newFunc.def.name === 'seriesByTag') {
            this.parseTarget();
        }
    };
    GraphiteQueryCtrl.prototype.removeFunction = function (func) {
        this.queryModel.removeFunction(func);
        this.targetChanged();
    };
    GraphiteQueryCtrl.prototype.moveFunction = function (func, offset) {
        this.queryModel.moveFunction(func, offset);
        this.targetChanged();
    };
    GraphiteQueryCtrl.prototype.addSeriesByTagFunc = function (tag) {
        var newFunc = this.datasource.createFuncInstance('seriesByTag', {
            withDefaultParams: false,
        });
        var tagParam = tag + "=";
        newFunc.params = [tagParam];
        this.queryModel.addFunction(newFunc);
        newFunc.added = true;
        this.emptySegments();
        this.targetChanged();
        this.parseTarget();
    };
    GraphiteQueryCtrl.prototype.smartlyHandleNewAliasByNode = function (func) {
        if (func.def.name !== 'aliasByNode') {
            return;
        }
        for (var i = 0; i < this.segments.length; i++) {
            if (this.segments[i].value.indexOf('*') >= 0) {
                func.params[0] = i;
                func.added = false;
                this.targetChanged();
                return;
            }
        }
    };
    GraphiteQueryCtrl.prototype.getAllTags = function () {
        var _this = this;
        return this.datasource.getTags().then(function (values) {
            var altTags = _.map(values, 'text');
            altTags.splice(0, 0, _this.removeTagValue);
            return mapToDropdownOptions(altTags);
        });
    };
    GraphiteQueryCtrl.prototype.getTags = function (index, tagPrefix) {
        var _this = this;
        var tagExpressions = this.queryModel.renderTagExpressions(index);
        return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then(function (values) {
            var altTags = _.map(values, 'text');
            altTags.splice(0, 0, _this.removeTagValue);
            return mapToDropdownOptions(altTags);
        });
    };
    GraphiteQueryCtrl.prototype.getTagsAsSegments = function (tagPrefix) {
        var _this = this;
        var tagExpressions = this.queryModel.renderTagExpressions();
        return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then(function (values) {
            return _.map(values, function (val) {
                return _this.uiSegmentSrv.newSegment({
                    value: val.text,
                    type: 'tag',
                    expandable: false,
                });
            });
        });
    };
    GraphiteQueryCtrl.prototype.getTagOperators = function () {
        return mapToDropdownOptions(GRAPHITE_TAG_OPERATORS);
    };
    GraphiteQueryCtrl.prototype.getAllTagValues = function (tag) {
        var tagKey = tag.key;
        return this.datasource.getTagValues(tagKey).then(function (values) {
            var altValues = _.map(values, 'text');
            return mapToDropdownOptions(altValues);
        });
    };
    GraphiteQueryCtrl.prototype.getTagValues = function (tag, index, valuePrefix) {
        var _this = this;
        var tagExpressions = this.queryModel.renderTagExpressions(index);
        var tagKey = tag.key;
        return this.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix).then(function (values) {
            var altValues = _.map(values, 'text');
            // Add template variables as additional values
            _.eachRight(_this.templateSrv.variables, function (variable) {
                altValues.push('${' + variable.name + ':regex}');
            });
            return mapToDropdownOptions(altValues);
        });
    };
    GraphiteQueryCtrl.prototype.tagChanged = function (tag, tagIndex) {
        this.queryModel.updateTag(tag, tagIndex);
        this.targetChanged();
    };
    GraphiteQueryCtrl.prototype.addNewTag = function (segment) {
        var newTagKey = segment.value;
        var newTag = { key: newTagKey, operator: '=', value: '' };
        this.queryModel.addTag(newTag);
        this.targetChanged();
        this.fixTagSegments();
    };
    GraphiteQueryCtrl.prototype.removeTag = function (index) {
        this.queryModel.removeTag(index);
        this.targetChanged();
    };
    GraphiteQueryCtrl.prototype.fixTagSegments = function () {
        // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
        this.addTagSegments = [this.uiSegmentSrv.newPlusButton()];
    };
    GraphiteQueryCtrl.prototype.showDelimiter = function (index) {
        return index !== this.queryModel.tags.length - 1;
    };
    GraphiteQueryCtrl.prototype.pause = function () {
        this.paused = true;
    };
    GraphiteQueryCtrl.prototype.unpause = function () {
        this.paused = false;
        this.panelCtrl.refresh();
    };
    GraphiteQueryCtrl.prototype.getCollapsedText = function () {
        return this.target.target;
    };
    GraphiteQueryCtrl.templateUrl = 'partials/query.editor.html';
    return GraphiteQueryCtrl;
}(QueryCtrl));
export { GraphiteQueryCtrl };
function mapToDropdownOptions(results) {
    return _.map(results, function (value) {
        return { text: value, value: value };
    });
}
function removeTagPrefix(value) {
    return value.replace(TAG_PREFIX, '');
}
//# sourceMappingURL=query_ctrl.js.map
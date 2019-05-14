import * as tslib_1 from "tslib";
import coreModule from 'app/core/core_module';
import { FilterSegments, DefaultFilterValue } from './filter_segments';
var StackdriverFilterCtrl = /** @class */ (function () {
    /** @ngInject */
    function StackdriverFilterCtrl($scope, uiSegmentSrv, templateSrv) {
        this.$scope = $scope;
        this.uiSegmentSrv = uiSegmentSrv;
        this.templateSrv = templateSrv;
        this.defaultRemoveGroupByValue = '-- remove group by --';
        this.resourceTypeValue = 'resource.type';
        this.$scope.ctrl = this;
        this.initSegments(this.hideGroupBys);
    }
    StackdriverFilterCtrl.prototype.initSegments = function (hideGroupBys) {
        var _this = this;
        if (!hideGroupBys) {
            this.groupBySegments = this.groupBys.map(function (groupBy) {
                return _this.uiSegmentSrv.getSegmentForValue(groupBy);
            });
            this.ensurePlusButton(this.groupBySegments);
        }
        this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' });
        this.filterSegments = new FilterSegments(this.uiSegmentSrv, this.filters, this.getFilterKeys.bind(this), this.getFilterValues.bind(this));
        this.filterSegments.buildSegmentModel();
    };
    StackdriverFilterCtrl.prototype.createLabelKeyElements = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var elements;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loading];
                    case 1:
                        _a.sent();
                        elements = Object.keys(this.labelData.metricLabels || {}).map(function (l) {
                            return _this.uiSegmentSrv.newSegment({
                                value: "metric.label." + l,
                                expandable: false,
                            });
                        });
                        elements = tslib_1.__spread(elements, Object.keys(this.labelData.resourceLabels || {}).map(function (l) {
                            return _this.uiSegmentSrv.newSegment({
                                value: "resource.label." + l,
                                expandable: false,
                            });
                        }));
                        if (this.labelData.resourceTypes && this.labelData.resourceTypes.length > 0) {
                            elements = tslib_1.__spread(elements, [
                                this.uiSegmentSrv.newSegment({
                                    value: this.resourceTypeValue,
                                    expandable: false,
                                }),
                            ]);
                        }
                        return [2 /*return*/, elements];
                }
            });
        });
    };
    StackdriverFilterCtrl.prototype.getFilterKeys = function (segment, removeText) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var elements, noValueOrPlusButton;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createLabelKeyElements()];
                    case 1:
                        elements = _a.sent();
                        if (this.filters.indexOf(this.resourceTypeValue) !== -1) {
                            elements = elements.filter(function (e) { return e.value !== _this.resourceTypeValue; });
                        }
                        noValueOrPlusButton = !segment || segment.type === 'plus-button';
                        if (noValueOrPlusButton && elements.length === 0) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, segment.type === 'plus-button'
                                ? elements
                                : tslib_1.__spread(elements, [
                                    this.uiSegmentSrv.newSegment({ fake: true, value: removeText || this.defaultRemoveGroupByValue }),
                                ])];
                }
            });
        });
    };
    StackdriverFilterCtrl.prototype.getGroupBys = function (segment) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var elements, noValueOrPlusButton;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createLabelKeyElements()];
                    case 1:
                        elements = _a.sent();
                        elements = elements.filter(function (e) { return _this.groupBys.indexOf(e.value) === -1; });
                        noValueOrPlusButton = !segment || segment.type === 'plus-button';
                        if (noValueOrPlusButton && elements.length === 0) {
                            return [2 /*return*/, []];
                        }
                        this.removeSegment.value = this.defaultRemoveGroupByValue;
                        return [2 /*return*/, segment.type === 'plus-button' ? elements : tslib_1.__spread(elements, [this.removeSegment])];
                }
            });
        });
    };
    StackdriverFilterCtrl.prototype.groupByChanged = function (segment, index) {
        if (segment.value === this.removeSegment.value) {
            this.groupBySegments.splice(index, 1);
        }
        else {
            segment.type = 'value';
        }
        var reducer = function (memo, seg) {
            if (!seg.fake) {
                memo.push(seg.value);
            }
            return memo;
        };
        var groupBys = this.groupBySegments.reduce(reducer, []);
        this.groupBysChanged({ groupBys: groupBys });
        this.ensurePlusButton(this.groupBySegments);
    };
    StackdriverFilterCtrl.prototype.getFilters = function (segment, index) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var hasNoFilterKeys;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loading];
                    case 1:
                        _a.sent();
                        hasNoFilterKeys = this.labelData.metricLabels && Object.keys(this.labelData.metricLabels).length === 0;
                        return [2 /*return*/, this.filterSegments.getFilters(segment, index, hasNoFilterKeys)];
                }
            });
        });
    };
    StackdriverFilterCtrl.prototype.getFilterValues = function (index) {
        var filterKey = this.templateSrv.replace(this.filterSegments.filterSegments[index - 2].value);
        if (!filterKey || !this.labelData.metricLabels || Object.keys(this.labelData.metricLabels).length === 0) {
            return [];
        }
        var shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);
        if (filterKey.startsWith('metric.label.') && this.labelData.metricLabels.hasOwnProperty(shortKey)) {
            return this.labelData.metricLabels[shortKey];
        }
        if (filterKey.startsWith('resource.label.') && this.labelData.resourceLabels.hasOwnProperty(shortKey)) {
            return this.labelData.resourceLabels[shortKey];
        }
        if (filterKey === this.resourceTypeValue) {
            return this.labelData.resourceTypes;
        }
        return [];
    };
    StackdriverFilterCtrl.prototype.filterSegmentUpdated = function (segment, index) {
        var filters = this.filterSegments.filterSegmentUpdated(segment, index);
        if (!filters.some(function (f) { return f === DefaultFilterValue; })) {
            this.filtersChanged({ filters: filters });
        }
    };
    StackdriverFilterCtrl.prototype.ensurePlusButton = function (segments) {
        var count = segments.length;
        var lastSegment = segments[Math.max(count - 1, 0)];
        if (!lastSegment || lastSegment.type !== 'plus-button') {
            segments.push(this.uiSegmentSrv.newPlusButton());
        }
    };
    return StackdriverFilterCtrl;
}());
export { StackdriverFilterCtrl };
/** @ngInject */
function stackdriverFilter() {
    return {
        templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.filter.html',
        controller: StackdriverFilterCtrl,
        controllerAs: 'ctrl',
        bindToController: true,
        restrict: 'E',
        scope: {
            labelData: '<',
            loading: '<',
            groupBys: '<',
            filters: '<',
            filtersChanged: '&',
            groupBysChanged: '&',
            hideGroupBys: '<',
        },
    };
}
coreModule.directive('stackdriverFilter', stackdriverFilter);
//# sourceMappingURL=query_filter_ctrl.js.map
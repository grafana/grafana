import * as tslib_1 from "tslib";
export var DefaultRemoveFilterValue = '-- remove filter --';
export var DefaultFilterValue = 'select value';
var FilterSegments = /** @class */ (function () {
    function FilterSegments(uiSegmentSrv, filters, getFilterKeysFunc, getFilterValuesFunc) {
        this.uiSegmentSrv = uiSegmentSrv;
        this.filters = filters;
        this.getFilterKeysFunc = getFilterKeysFunc;
        this.getFilterValuesFunc = getFilterValuesFunc;
    }
    FilterSegments.prototype.buildSegmentModel = function () {
        var _this = this;
        this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: DefaultRemoveFilterValue });
        this.filterSegments = [];
        this.filters.forEach(function (f, index) {
            switch (index % 4) {
                case 0:
                    _this.filterSegments.push(_this.uiSegmentSrv.newKey(f));
                    break;
                case 1:
                    _this.filterSegments.push(_this.uiSegmentSrv.newOperator(f));
                    break;
                case 2:
                    _this.filterSegments.push(_this.uiSegmentSrv.newKeyValue(f));
                    break;
                case 3:
                    _this.filterSegments.push(_this.uiSegmentSrv.newCondition(f));
                    break;
            }
        });
        this.ensurePlusButton(this.filterSegments);
    };
    FilterSegments.prototype.getFilters = function (segment, index, hasNoFilterKeys) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var filterValues;
            return tslib_1.__generator(this, function (_a) {
                if (segment.type === 'condition') {
                    return [2 /*return*/, [this.uiSegmentSrv.newSegment('AND')]];
                }
                if (segment.type === 'operator') {
                    return [2 /*return*/, this.uiSegmentSrv.newOperators(['=', '!=', '=~', '!=~'])];
                }
                if (segment.type === 'key' || segment.type === 'plus-button') {
                    if (hasNoFilterKeys && segment.value && segment.value !== DefaultRemoveFilterValue) {
                        this.removeSegment.value = DefaultRemoveFilterValue;
                        return [2 /*return*/, Promise.resolve([this.removeSegment])];
                    }
                    else {
                        return [2 /*return*/, this.getFilterKeysFunc(segment, DefaultRemoveFilterValue)];
                    }
                }
                if (segment.type === 'value') {
                    filterValues = this.getFilterValuesFunc(index);
                    if (filterValues.length > 0) {
                        return [2 /*return*/, this.getValuesForFilterKey(filterValues)];
                    }
                }
                return [2 /*return*/, []];
            });
        });
    };
    FilterSegments.prototype.getValuesForFilterKey = function (labels) {
        var _this = this;
        var filterValues = labels.map(function (l) {
            return _this.uiSegmentSrv.newSegment({
                value: "" + l,
                expandable: false,
            });
        });
        return filterValues;
    };
    FilterSegments.prototype.addNewFilterSegments = function (segment, index) {
        if (index > 2) {
            this.filterSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
        segment.type = 'key';
        this.filterSegments.push(this.uiSegmentSrv.newOperator('='));
        this.filterSegments.push(this.uiSegmentSrv.newFake(DefaultFilterValue, 'value', 'query-segment-value'));
    };
    FilterSegments.prototype.removeFilterSegment = function (index) {
        this.filterSegments.splice(index, 3);
        // remove trailing condition
        if (index > 2 && this.filterSegments[index - 1].type === 'condition') {
            this.filterSegments.splice(index - 1, 1);
        }
        // remove condition if it is first segment
        if (index === 0 && this.filterSegments.length > 0 && this.filterSegments[0].type === 'condition') {
            this.filterSegments.splice(0, 1);
        }
    };
    FilterSegments.prototype.ensurePlusButton = function (segments) {
        var count = segments.length;
        var lastSegment = segments[Math.max(count - 1, 0)];
        if (!lastSegment || lastSegment.type !== 'plus-button') {
            segments.push(this.uiSegmentSrv.newPlusButton());
        }
    };
    FilterSegments.prototype.filterSegmentUpdated = function (segment, index) {
        if (segment.type === 'plus-button') {
            this.addNewFilterSegments(segment, index);
        }
        else if (segment.type === 'key' && segment.value === DefaultRemoveFilterValue) {
            this.removeFilterSegment(index);
            this.ensurePlusButton(this.filterSegments);
        }
        else if (segment.type === 'value' && segment.value !== DefaultFilterValue) {
            this.ensurePlusButton(this.filterSegments);
        }
        return this.filterSegments.filter(function (s) { return s.type !== 'plus-button'; }).map(function (seg) { return seg.value; });
    };
    return FilterSegments;
}());
export { FilterSegments };
//# sourceMappingURL=filter_segments.js.map
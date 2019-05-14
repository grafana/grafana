import * as tslib_1 from "tslib";
import _ from 'lodash';
import angular from 'angular';
import coreModule from 'app/core/core_module';
var AdHocFiltersCtrl = /** @class */ (function () {
    /** @ngInject */
    function AdHocFiltersCtrl(uiSegmentSrv, datasourceSrv, $q, variableSrv, $scope) {
        this.uiSegmentSrv = uiSegmentSrv;
        this.datasourceSrv = datasourceSrv;
        this.$q = $q;
        this.variableSrv = variableSrv;
        this.removeTagFilterSegment = uiSegmentSrv.newSegment({
            fake: true,
            value: '-- remove filter --',
        });
        this.buildSegmentModel();
        this.dashboard.events.on('template-variable-value-updated', this.buildSegmentModel.bind(this), $scope);
    }
    AdHocFiltersCtrl.prototype.buildSegmentModel = function () {
        var e_1, _a;
        this.segments = [];
        if (this.variable.value && !_.isArray(this.variable.value)) {
        }
        try {
            for (var _b = tslib_1.__values(this.variable.filters), _c = _b.next(); !_c.done; _c = _b.next()) {
                var tag = _c.value;
                if (this.segments.length > 0) {
                    this.segments.push(this.uiSegmentSrv.newCondition('AND'));
                }
                if (tag.key !== undefined && tag.value !== undefined) {
                    this.segments.push(this.uiSegmentSrv.newKey(tag.key));
                    this.segments.push(this.uiSegmentSrv.newOperator(tag.operator));
                    this.segments.push(this.uiSegmentSrv.newKeyValue(tag.value));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        this.segments.push(this.uiSegmentSrv.newPlusButton());
    };
    AdHocFiltersCtrl.prototype.getOptions = function (segment, index) {
        var _this = this;
        if (segment.type === 'operator') {
            return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<', '>', '=~', '!~']));
        }
        if (segment.type === 'condition') {
            return this.$q.when([this.uiSegmentSrv.newSegment('AND')]);
        }
        return this.datasourceSrv.get(this.variable.datasource).then(function (ds) {
            var options = {};
            var promise = null;
            if (segment.type !== 'value') {
                promise = ds.getTagKeys ? ds.getTagKeys() : Promise.resolve([]);
            }
            else {
                options.key = _this.segments[index - 2].value;
                promise = ds.getTagValues ? ds.getTagValues(options) : Promise.resolve([]);
            }
            return promise.then(function (results) {
                results = _.map(results, function (segment) {
                    return _this.uiSegmentSrv.newSegment({ value: segment.text });
                });
                // add remove option for keys
                if (segment.type === 'key') {
                    results.splice(0, 0, angular.copy(_this.removeTagFilterSegment));
                }
                return results;
            });
        });
    };
    AdHocFiltersCtrl.prototype.segmentChanged = function (segment, index) {
        this.segments[index] = segment;
        // handle remove tag condition
        if (segment.value === this.removeTagFilterSegment.value) {
            this.segments.splice(index, 3);
            if (this.segments.length === 0) {
                this.segments.push(this.uiSegmentSrv.newPlusButton());
            }
            else if (this.segments.length > 2) {
                this.segments.splice(Math.max(index - 1, 0), 1);
                if (this.segments[this.segments.length - 1].type !== 'plus-button') {
                    this.segments.push(this.uiSegmentSrv.newPlusButton());
                }
            }
        }
        else {
            if (segment.type === 'plus-button') {
                if (index > 2) {
                    this.segments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
                }
                this.segments.push(this.uiSegmentSrv.newOperator('='));
                this.segments.push(this.uiSegmentSrv.newFake('select value', 'value', 'query-segment-value'));
                segment.type = 'key';
                segment.cssClass = 'query-segment-key';
            }
            if (index + 1 === this.segments.length) {
                this.segments.push(this.uiSegmentSrv.newPlusButton());
            }
        }
        this.updateVariableModel();
    };
    AdHocFiltersCtrl.prototype.updateVariableModel = function () {
        var filters = [];
        var filterIndex = -1;
        var hasFakes = false;
        this.segments.forEach(function (segment) {
            if (segment.type === 'value' && segment.fake) {
                hasFakes = true;
                return;
            }
            switch (segment.type) {
                case 'key': {
                    filters.push({ key: segment.value });
                    filterIndex += 1;
                    break;
                }
                case 'value': {
                    filters[filterIndex].value = segment.value;
                    break;
                }
                case 'operator': {
                    filters[filterIndex].operator = segment.value;
                    break;
                }
                case 'condition': {
                    filters[filterIndex].condition = segment.value;
                    break;
                }
            }
        });
        if (hasFakes) {
            return;
        }
        this.variable.setFilters(filters);
        this.variableSrv.variableUpdated(this.variable, true);
    };
    return AdHocFiltersCtrl;
}());
export { AdHocFiltersCtrl };
var template = "\n<div class=\"gf-form-inline\">\n  <div class=\"gf-form\" ng-repeat=\"segment in ctrl.segments\">\n    <metric-segment segment=\"segment\" get-options=\"ctrl.getOptions(segment, $index)\"\n                    on-change=\"ctrl.segmentChanged(segment, $index)\"></metric-segment>\n  </div>\n</div>\n";
export function adHocFiltersComponent() {
    return {
        restrict: 'E',
        template: template,
        controller: AdHocFiltersCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            variable: '=',
            dashboard: '=',
        },
    };
}
coreModule.directive('adHocFilters', adHocFiltersComponent);
//# sourceMappingURL=AdHocFiltersCtrl.js.map
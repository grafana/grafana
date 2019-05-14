import * as tslib_1 from "tslib";
import React from 'react';
import appEvents from 'app/core/app_events';
import { getAngularLoader } from 'app/core/services/AngularLoader';
import '../query_filter_ctrl';
var labelData = {
    metricLabels: {},
    resourceLabels: {},
    resourceTypes: [],
};
var Filter = /** @class */ (function (_super) {
    tslib_1.__extends(Filter, _super);
    function Filter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Filter.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, groupBys, filters, hideGroupBys, loader, filtersChanged, groupBysChanged, scopeProps, loading, template;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                if (!this.element) {
                    return [2 /*return*/];
                }
                _a = this.props, groupBys = _a.groupBys, filters = _a.filters, hideGroupBys = _a.hideGroupBys;
                loader = getAngularLoader();
                filtersChanged = function (filters) {
                    _this.props.filtersChanged(filters);
                };
                groupBysChanged = function (groupBys) {
                    _this.props.groupBysChanged(groupBys);
                };
                scopeProps = {
                    loading: null,
                    labelData: labelData,
                    groupBys: groupBys,
                    filters: filters,
                    filtersChanged: filtersChanged,
                    groupBysChanged: groupBysChanged,
                    hideGroupBys: hideGroupBys,
                };
                loading = this.loadLabels(scopeProps);
                scopeProps.loading = loading;
                template = "<stackdriver-filter\n                        filters=\"filters\"\n                        group-bys=\"groupBys\"\n                        label-data=\"labelData\"\n                        loading=\"loading\"\n                        filters-changed=\"filtersChanged(filters)\"\n                        group-bys-changed=\"groupBysChanged(groupBys)\"\n                        hide-group-bys=\"hideGroupBys\"/>";
                this.component = loader.load(this.element, scopeProps, template);
                return [2 /*return*/];
            });
        });
    };
    Filter.prototype.componentDidUpdate = function (prevProps) {
        if (!this.element) {
            return;
        }
        var scope = this.component.getScope();
        if (prevProps.metricType !== this.props.metricType) {
            scope.loading = this.loadLabels(scope);
        }
        scope.filters = this.props.filters;
        scope.groupBys = this.props.groupBys;
    };
    Filter.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    Filter.prototype.loadLabels = function (scope) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        var meta, error_1;
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    if (!!this.props.metricType) return [3 /*break*/, 1];
                                    scope.labelData = labelData;
                                    return [3 /*break*/, 3];
                                case 1: return [4 /*yield*/, this.props.datasource.getLabels(this.props.metricType, this.props.refId)];
                                case 2:
                                    meta = (_a.sent()).meta;
                                    scope.labelData = meta;
                                    _a.label = 3;
                                case 3:
                                    resolve();
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_1 = _a.sent();
                                    appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.props.metricType]);
                                    scope.labelData = labelData;
                                    resolve();
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    Filter.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { ref: function (element) { return (_this.element = element); }, style: { width: '100%' } });
    };
    return Filter;
}(React.Component));
export { Filter };
//# sourceMappingURL=Filter.js.map
import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { getLocationSrv } from '@grafana/runtime';
var PanelEditorQueries = /** @class */ (function (_super) {
    __extends(PanelEditorQueries, _super);
    function PanelEditorQueries(props) {
        var _this = _super.call(this, props) || this;
        _this.onRunQueries = function () {
            _this.props.panel.refresh();
        };
        _this.onOpenQueryInspector = function () {
            getLocationSrv().update({
                query: { inspect: _this.props.panel.id, inspectTab: 'query' },
                partial: true,
            });
        };
        _this.onOptionsChange = function (options) {
            var _a;
            var panel = _this.props.panel;
            var newDataSourceID = options.dataSource.default ? null : options.dataSource.uid;
            var dataSourceChanged = newDataSourceID !== ((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid);
            panel.updateQueries(options);
            if (dataSourceChanged) {
                // trigger queries when changing data source
                setTimeout(_this.onRunQueries, 10);
            }
            _this.forceUpdate();
        };
        return _this;
    }
    PanelEditorQueries.prototype.buildQueryOptions = function (panel) {
        var _a;
        var dataSource = ((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid)
            ? __assign({ default: false }, panel.datasource) : {
            default: true,
        };
        return {
            dataSource: dataSource,
            queries: panel.targets,
            maxDataPoints: panel.maxDataPoints,
            minInterval: panel.interval,
            timeRange: {
                from: panel.timeFrom,
                shift: panel.timeShift,
                hide: panel.hideTimeOverride,
            },
        };
    };
    PanelEditorQueries.prototype.render = function () {
        var panel = this.props.panel;
        var options = this.buildQueryOptions(panel);
        return (React.createElement(QueryGroup, { options: options, queryRunner: panel.getQueryRunner(), onRunQueries: this.onRunQueries, onOpenQueryInspector: this.onOpenQueryInspector, onOptionsChange: this.onOptionsChange }));
    };
    return PanelEditorQueries;
}(PureComponent));
export { PanelEditorQueries };
//# sourceMappingURL=PanelEditorQueries.js.map
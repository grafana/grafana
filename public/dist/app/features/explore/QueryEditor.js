import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Services
import { getAngularLoader } from 'app/core/services/AngularLoader';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import 'app/features/plugins/plugin_loader';
var QueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(QueryEditor, _super);
    function QueryEditor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryEditor.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, datasource, initialQuery, exploreEvents, range, loader, template, target, scopeProps;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                if (!this.element) {
                    return [2 /*return*/];
                }
                _a = this.props, datasource = _a.datasource, initialQuery = _a.initialQuery, exploreEvents = _a.exploreEvents, range = _a.range;
                this.initTimeSrv(range);
                loader = getAngularLoader();
                template = '<plugin-component type="query-ctrl"> </plugin-component>';
                target = tslib_1.__assign({ datasource: datasource.name }, initialQuery);
                scopeProps = {
                    ctrl: {
                        datasource: datasource,
                        target: target,
                        refresh: function () {
                            _this.props.onQueryChange(target);
                            _this.props.onExecuteQuery();
                        },
                        onQueryChange: function () {
                            _this.props.onQueryChange(target);
                        },
                        events: exploreEvents,
                        panel: { datasource: datasource, targets: [target] },
                        dashboard: {},
                    },
                };
                this.component = loader.load(this.element, scopeProps, template);
                this.props.onQueryChange(target);
                return [2 /*return*/];
            });
        });
    };
    QueryEditor.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    QueryEditor.prototype.initTimeSrv = function (range) {
        var timeSrv = getTimeSrv();
        timeSrv.init({
            time: range,
            refresh: false,
            getTimezone: function () { return 'utc'; },
            timeRangeUpdated: function () { return console.log('refreshDashboard!'); },
        });
    };
    QueryEditor.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { className: "gf-form-query", ref: function (element) { return (_this.element = element); }, style: { width: '100%' } });
    };
    return QueryEditor;
}(PureComponent));
export default QueryEditor;
//# sourceMappingURL=QueryEditor.js.map
import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Icon, ConfirmButton, Button } from '@grafana/ui';
import alertDef from './state/alertDef';
import { css } from '@emotion/css';
var StateHistory = /** @class */ (function (_super) {
    __extends(StateHistory, _super);
    function StateHistory() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            stateHistoryItems: [],
        };
        _this.clearHistory = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, dashboard, panelId, onRefresh;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, dashboard = _a.dashboard, panelId = _a.panelId, onRefresh = _a.onRefresh;
                        return [4 /*yield*/, getBackendSrv().post('/api/annotations/mass-delete', {
                                dashboardId: dashboard.id,
                                panelId: panelId,
                            })];
                    case 1:
                        _b.sent();
                        this.setState({ stateHistoryItems: [] });
                        onRefresh();
                        return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    StateHistory.prototype.componentDidMount = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, panelId = _a.panelId;
        getBackendSrv()
            .get("/api/annotations?dashboardId=" + dashboard.id + "&panelId=" + panelId + "&limit=50&type=alert", {}, "state-history-" + dashboard.id + "-" + panelId)
            .then(function (data) {
            var items = data.map(function (item) {
                return {
                    stateModel: alertDef.getStateDisplayModel(item.newState),
                    time: dashboard.formatDate(item.time, 'MMM D, YYYY HH:mm:ss'),
                    info: alertDef.getAlertAnnotationInfo(item),
                };
            });
            _this.setState({
                stateHistoryItems: items,
            });
        });
    };
    StateHistory.prototype.render = function () {
        var stateHistoryItems = this.state.stateHistoryItems;
        return (React.createElement("div", null,
            stateHistoryItems.length > 0 && (React.createElement("div", { className: "p-b-1" },
                React.createElement("span", { className: "muted" }, "Last 50 state changes"),
                React.createElement(ConfirmButton, { onConfirm: this.clearHistory, confirmVariant: "destructive", confirmText: "Clear" },
                    React.createElement(Button, { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                  direction: ltr;\n                "], ["\n                  direction: ltr;\n                "]))), variant: "destructive", icon: "trash-alt" }, "Clear history")))),
            React.createElement("ol", { className: "alert-rule-list" }, stateHistoryItems.length > 0 ? (stateHistoryItems.map(function (item, index) {
                return (React.createElement("li", { className: "alert-rule-item", key: item.time + "-" + index },
                    React.createElement("div", { className: "alert-rule-item__icon " + item.stateModel.stateClass },
                        React.createElement(Icon, { name: item.stateModel.iconClass, size: "xl" })),
                    React.createElement("div", { className: "alert-rule-item__body" },
                        React.createElement("div", { className: "alert-rule-item__header" },
                            React.createElement("p", { className: "alert-rule-item__name" }, item.alertName),
                            React.createElement("div", { className: "alert-rule-item__text" },
                                React.createElement("span", { className: "" + item.stateModel.stateClass }, item.stateModel.text))),
                        item.info),
                    React.createElement("div", { className: "alert-rule-item__time" }, item.time)));
            })) : (React.createElement("i", null, "No state changes recorded")))));
    };
    return StateHistory;
}(PureComponent));
export default StateHistory;
var templateObject_1;
//# sourceMappingURL=StateHistory.js.map
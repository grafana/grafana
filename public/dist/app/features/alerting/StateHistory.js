import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import alertDef from './state/alertDef';
import { getBackendSrv } from 'app/core/services/backend_srv';
import appEvents from '../../core/app_events';
var StateHistory = /** @class */ (function (_super) {
    tslib_1.__extends(StateHistory, _super);
    function StateHistory() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            stateHistoryItems: [],
        };
        _this.clearHistory = function () {
            var _a = _this.props, dashboard = _a.dashboard, onRefresh = _a.onRefresh, panelId = _a.panelId;
            appEvents.emit('confirm-modal', {
                title: 'Delete Alert History',
                text: 'Are you sure you want to remove all history & annotations for this alert?',
                icon: 'fa-trash',
                yesText: 'Yes',
                onConfirm: function () {
                    getBackendSrv()
                        .post('/api/annotations/mass-delete', {
                        dashboardId: dashboard.id,
                        panelId: panelId,
                    })
                        .then(function () {
                        onRefresh();
                    });
                    _this.setState({
                        stateHistoryItems: [],
                    });
                },
            });
        };
        return _this;
    }
    StateHistory.prototype.componentDidMount = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, panelId = _a.panelId;
        getBackendSrv()
            .get("/api/annotations?dashboardId=" + dashboard.id + "&panelId=" + panelId + "&limit=50&type=alert")
            .then(function (res) {
            var items = res.map(function (item) {
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
                React.createElement("button", { className: "btn btn-mini btn-danger pull-right", onClick: this.clearHistory },
                    React.createElement("i", { className: "fa fa-trash" }),
                    " ", " Clear history"))),
            React.createElement("ol", { className: "alert-rule-list" }, stateHistoryItems.length > 0 ? (stateHistoryItems.map(function (item, index) {
                return (React.createElement("li", { className: "alert-rule-item", key: item.time + "-" + index },
                    React.createElement("div", { className: "alert-rule-item__icon " + item.stateModel.stateClass },
                        React.createElement("i", { className: item.stateModel.iconClass })),
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
//# sourceMappingURL=StateHistory.js.map
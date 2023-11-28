import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Icon, ConfirmButton, Button } from '@grafana/ui';
import alertDef from './state/alertDef';
class StateHistory extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            stateHistoryItems: [],
        };
        this.clearHistory = () => __awaiter(this, void 0, void 0, function* () {
            const { dashboard, panelId, onRefresh } = this.props;
            yield getBackendSrv().post('/api/annotations/mass-delete', {
                dashboardId: dashboard.id,
                panelId: panelId,
            });
            this.setState({ stateHistoryItems: [] });
            onRefresh();
        });
    }
    componentDidMount() {
        const { dashboard, panelId } = this.props;
        getBackendSrv()
            .get(`/api/annotations?dashboardId=${dashboard.id}&panelId=${panelId}&limit=50&type=alert`, {}, `state-history-${dashboard.id}-${panelId}`)
            .then((data) => {
            const items = data.map((item) => {
                return {
                    stateModel: alertDef.getStateDisplayModel(item.newState),
                    time: dashboard.formatDate(item.time, 'MMM D, YYYY HH:mm:ss'),
                    info: alertDef.getAlertAnnotationInfo(item),
                };
            });
            this.setState({
                stateHistoryItems: items,
            });
        });
    }
    render() {
        const { stateHistoryItems } = this.state;
        return (React.createElement("div", null,
            stateHistoryItems.length > 0 && (React.createElement("div", { className: "p-b-1" },
                React.createElement("span", { className: "muted" }, "Last 50 state changes"),
                React.createElement(ConfirmButton, { onConfirm: this.clearHistory, confirmVariant: "destructive", confirmText: "Clear" },
                    React.createElement(Button, { className: css `
                  direction: ltr;
                `, variant: "destructive", icon: "trash-alt" }, "Clear history")))),
            React.createElement("ol", { className: "alert-rule-list" }, stateHistoryItems.length > 0 ? (stateHistoryItems.map((item, index) => {
                return (React.createElement("li", { className: "alert-rule-item", key: `${item.time}-${index}` },
                    React.createElement("div", { className: `alert-rule-item__icon ${item.stateModel.stateClass}` },
                        React.createElement(Icon, { name: item.stateModel.iconClass, size: "xl" })),
                    React.createElement("div", { className: "alert-rule-item__body" },
                        React.createElement("div", { className: "alert-rule-item__header" },
                            React.createElement("p", { className: "alert-rule-item__name" }, item.alertName),
                            React.createElement("div", { className: "alert-rule-item__text" },
                                React.createElement("span", { className: `${item.stateModel.stateClass}` }, item.stateModel.text))),
                        item.info),
                    React.createElement("div", { className: "alert-rule-item__time" }, item.time)));
            })) : (React.createElement("i", null, "No state changes recorded")))));
    }
}
export default StateHistory;
//# sourceMappingURL=StateHistory.js.map
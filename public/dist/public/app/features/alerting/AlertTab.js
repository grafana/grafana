import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { EventBusSrv } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getAngularLoader, getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, ConfirmModal, Container, CustomScrollbar, HorizontalGroup, Modal } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { AppNotificationSeverity } from 'app/types';
import { PanelNotSupported } from '../dashboard/components/PanelEditor/PanelNotSupported';
import StateHistory from './StateHistory';
import { TestRuleResult } from './TestRuleResult';
import { getAlertingValidationMessage } from './getAlertingValidationMessage';
class UnConnectedAlertTab extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            validationMessage: '',
            showStateHistory: false,
            showDeleteConfirmation: false,
            showTestRule: false,
        };
        this.onAngularPanelUpdated = () => {
            this.forceUpdate();
        };
        this.onAddAlert = () => {
            var _a, _b;
            (_a = this.panelCtrl) === null || _a === void 0 ? void 0 : _a._enableAlert();
            (_b = this.component) === null || _b === void 0 ? void 0 : _b.digest();
            this.forceUpdate();
        };
        this.onToggleModal = (prop) => {
            const value = this.state[prop];
            this.setState(Object.assign(Object.assign({}, this.state), { [prop]: !value }));
        };
        this.renderTestRule = () => {
            if (!this.state.showTestRule) {
                return null;
            }
            const { panel, dashboard } = this.props;
            const onDismiss = () => this.onToggleModal('showTestRule');
            return (React.createElement(Modal, { isOpen: true, icon: "bug", title: "Testing rule", onDismiss: onDismiss, onClickBackdrop: onDismiss },
                React.createElement(TestRuleResult, { panel: panel, dashboard: dashboard })));
        };
        this.renderDeleteConfirmation = () => {
            if (!this.state.showDeleteConfirmation) {
                return null;
            }
            const { panel } = this.props;
            const onDismiss = () => this.onToggleModal('showDeleteConfirmation');
            return (React.createElement(ConfirmModal, { isOpen: true, icon: "trash-alt", title: "Delete", body: React.createElement("div", null,
                    "Are you sure you want to delete this alert rule?",
                    React.createElement("br", null),
                    React.createElement("small", null, "You need to save dashboard for the delete to take effect.")), confirmText: "Delete alert", onDismiss: onDismiss, onConfirm: () => {
                    var _a;
                    delete panel.alert;
                    panel.thresholds = [];
                    if (this.panelCtrl) {
                        this.panelCtrl.alertState = null;
                        this.panelCtrl.render();
                    }
                    (_a = this.component) === null || _a === void 0 ? void 0 : _a.digest();
                    onDismiss();
                } }));
        };
        this.renderStateHistory = () => {
            if (!this.state.showStateHistory) {
                return null;
            }
            const { panel, dashboard } = this.props;
            const onDismiss = () => this.onToggleModal('showStateHistory');
            return (React.createElement(Modal, { isOpen: true, icon: "history", title: "State history", onDismiss: onDismiss, onClickBackdrop: onDismiss },
                React.createElement(StateHistory, { dashboard: dashboard, panelId: panel.id, onRefresh: () => { var _a; return (_a = this.panelCtrl) === null || _a === void 0 ? void 0 : _a.refresh(); } })));
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            if (config.angularSupportEnabled) {
                yield import(/* webpackChunkName: "AlertTabCtrl" */ 'app/features/alerting/AlertTabCtrl');
                this.loadAlertTab();
            }
            else {
                // TODO probably need to migrate AlertTab to react
                alert('Angular support disabled, legacy alerting cannot function without angular support');
            }
        });
    }
    componentDidUpdate(prevProps) {
        this.loadAlertTab();
    }
    componentWillUnmount() {
        if (this.component) {
            this.component.destroy();
        }
    }
    loadAlertTab() {
        return __awaiter(this, void 0, void 0, function* () {
            const { panel, angularPanelComponent } = this.props;
            if (!this.element || this.component) {
                return;
            }
            if (angularPanelComponent) {
                const scope = angularPanelComponent.getScope();
                // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
                if (!scope.$$childHead) {
                    setTimeout(() => {
                        this.forceUpdate();
                    });
                    return;
                }
                this.panelCtrl = scope.$$childHead.ctrl;
            }
            else {
                this.panelCtrl = this.getReactAlertPanelCtrl();
            }
            const loader = getAngularLoader();
            const template = '<alert-tab />';
            const scopeProps = { ctrl: this.panelCtrl };
            this.component = loader.load(this.element, scopeProps, template);
            const validationMessage = yield getAlertingValidationMessage(panel.transformations, panel.targets, getDataSourceSrv(), panel.datasource);
            if (validationMessage) {
                this.setState({ validationMessage });
            }
        });
    }
    getReactAlertPanelCtrl() {
        return {
            panel: this.props.panel,
            events: new EventBusSrv(),
            render: () => {
                this.props.panel.render();
            },
        };
    }
    render() {
        const { alert, transformations } = this.props.panel;
        const { validationMessage } = this.state;
        const hasTransformations = transformations && transformations.length > 0;
        if (!alert && validationMessage) {
            return React.createElement(PanelNotSupported, { message: validationMessage });
        }
        const model = {
            title: 'Panel has no alert rule defined',
            buttonIcon: 'bell',
            onClick: this.onAddAlert,
            buttonTitle: 'Create Alert',
        };
        return (React.createElement(React.Fragment, null,
            React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
                React.createElement(Container, { padding: "md" },
                    React.createElement("div", { "aria-label": selectors.components.AlertTab.content },
                        alert && hasTransformations && (React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: "Transformations are not supported in alert queries" })),
                        React.createElement("div", { ref: (element) => (this.element = element) }),
                        alert && (React.createElement(HorizontalGroup, null,
                            React.createElement(Button, { onClick: () => this.onToggleModal('showStateHistory'), variant: "secondary" }, "State history"),
                            React.createElement(Button, { onClick: () => this.onToggleModal('showTestRule'), variant: "secondary" }, "Test rule"),
                            React.createElement(Button, { onClick: () => this.onToggleModal('showDeleteConfirmation'), variant: "destructive" }, "Delete"))),
                        !alert && !validationMessage && React.createElement(EmptyListCTA, Object.assign({}, model))))),
            this.renderTestRule(),
            this.renderDeleteConfirmation(),
            this.renderStateHistory()));
    }
}
const mapStateToProps = (state, props) => {
    var _a;
    return {
        angularPanelComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    };
};
const mapDispatchToProps = {};
export const AlertTab = connect(mapStateToProps, mapDispatchToProps)(UnConnectedAlertTab);
//# sourceMappingURL=AlertTab.js.map
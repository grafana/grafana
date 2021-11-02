import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Alert, Button, ConfirmModal, Container, CustomScrollbar, HorizontalGroup, Modal } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { getAngularLoader, getDataSourceSrv } from '@grafana/runtime';
import { getAlertingValidationMessage } from './getAlertingValidationMessage';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import StateHistory from './StateHistory';
import 'app/features/alerting/AlertTabCtrl';
import { TestRuleResult } from './TestRuleResult';
import { AppNotificationSeverity } from 'app/types';
import { PanelNotSupported } from '../dashboard/components/PanelEditor/PanelNotSupported';
import { EventBusSrv } from '@grafana/data';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
var UnConnectedAlertTab = /** @class */ (function (_super) {
    __extends(UnConnectedAlertTab, _super);
    function UnConnectedAlertTab() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            validationMessage: '',
            showStateHistory: false,
            showDeleteConfirmation: false,
            showTestRule: false,
        };
        _this.onAngularPanelUpdated = function () {
            _this.forceUpdate();
        };
        _this.onAddAlert = function () {
            var _a, _b;
            (_a = _this.panelCtrl) === null || _a === void 0 ? void 0 : _a._enableAlert();
            (_b = _this.component) === null || _b === void 0 ? void 0 : _b.digest();
            _this.forceUpdate();
        };
        _this.onToggleModal = function (prop) {
            var _a;
            var value = _this.state[prop];
            _this.setState(__assign(__assign({}, _this.state), (_a = {}, _a[prop] = !value, _a)));
        };
        _this.renderTestRule = function () {
            if (!_this.state.showTestRule) {
                return null;
            }
            var _a = _this.props, panel = _a.panel, dashboard = _a.dashboard;
            var onDismiss = function () { return _this.onToggleModal('showTestRule'); };
            return (React.createElement(Modal, { isOpen: true, icon: "bug", title: "Testing rule", onDismiss: onDismiss, onClickBackdrop: onDismiss },
                React.createElement(TestRuleResult, { panel: panel, dashboard: dashboard })));
        };
        _this.renderDeleteConfirmation = function () {
            if (!_this.state.showDeleteConfirmation) {
                return null;
            }
            var panel = _this.props.panel;
            var onDismiss = function () { return _this.onToggleModal('showDeleteConfirmation'); };
            return (React.createElement(ConfirmModal, { isOpen: true, icon: "trash-alt", title: "Delete", body: React.createElement("div", null,
                    "Are you sure you want to delete this alert rule?",
                    React.createElement("br", null),
                    React.createElement("small", null, "You need to save dashboard for the delete to take effect.")), confirmText: "Delete alert", onDismiss: onDismiss, onConfirm: function () {
                    var _a;
                    delete panel.alert;
                    panel.thresholds = [];
                    if (_this.panelCtrl) {
                        _this.panelCtrl.alertState = null;
                        _this.panelCtrl.render();
                    }
                    (_a = _this.component) === null || _a === void 0 ? void 0 : _a.digest();
                    onDismiss();
                } }));
        };
        _this.renderStateHistory = function () {
            if (!_this.state.showStateHistory) {
                return null;
            }
            var _a = _this.props, panel = _a.panel, dashboard = _a.dashboard;
            var onDismiss = function () { return _this.onToggleModal('showStateHistory'); };
            return (React.createElement(Modal, { isOpen: true, icon: "history", title: "State history", onDismiss: onDismiss, onClickBackdrop: onDismiss },
                React.createElement(StateHistory, { dashboard: dashboard, panelId: panel.id, onRefresh: function () { var _a; return (_a = _this.panelCtrl) === null || _a === void 0 ? void 0 : _a.refresh(); } })));
        };
        return _this;
    }
    UnConnectedAlertTab.prototype.componentDidMount = function () {
        this.loadAlertTab();
    };
    UnConnectedAlertTab.prototype.componentDidUpdate = function (prevProps) {
        this.loadAlertTab();
    };
    UnConnectedAlertTab.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    UnConnectedAlertTab.prototype.loadAlertTab = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, panel, angularPanelComponent, scope, loader, template, scopeProps, validationMessage;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, panel = _a.panel, angularPanelComponent = _a.angularPanelComponent;
                        if (!this.element || this.component) {
                            return [2 /*return*/];
                        }
                        if (angularPanelComponent) {
                            scope = angularPanelComponent.getScope();
                            // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
                            if (!scope.$$childHead) {
                                setTimeout(function () {
                                    _this.forceUpdate();
                                });
                                return [2 /*return*/];
                            }
                            this.panelCtrl = scope.$$childHead.ctrl;
                        }
                        else {
                            this.panelCtrl = this.getReactAlertPanelCtrl();
                        }
                        loader = getAngularLoader();
                        template = '<alert-tab />';
                        scopeProps = { ctrl: this.panelCtrl };
                        this.component = loader.load(this.element, scopeProps, template);
                        return [4 /*yield*/, getAlertingValidationMessage(panel.transformations, panel.targets, getDataSourceSrv(), panel.datasource)];
                    case 1:
                        validationMessage = _b.sent();
                        if (validationMessage) {
                            this.setState({ validationMessage: validationMessage });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    UnConnectedAlertTab.prototype.getReactAlertPanelCtrl = function () {
        var _this = this;
        return {
            panel: this.props.panel,
            events: new EventBusSrv(),
            render: function () {
                _this.props.panel.render();
            },
        };
    };
    UnConnectedAlertTab.prototype.render = function () {
        var _this = this;
        var _a = this.props.panel, alert = _a.alert, transformations = _a.transformations;
        var validationMessage = this.state.validationMessage;
        var hasTransformations = transformations && transformations.length > 0;
        if (!alert && validationMessage) {
            return React.createElement(PanelNotSupported, { message: validationMessage });
        }
        var model = {
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
                        React.createElement("div", { ref: function (element) { return (_this.element = element); } }),
                        alert && (React.createElement(HorizontalGroup, null,
                            React.createElement(Button, { onClick: function () { return _this.onToggleModal('showStateHistory'); }, variant: "secondary" }, "State history"),
                            React.createElement(Button, { onClick: function () { return _this.onToggleModal('showTestRule'); }, variant: "secondary" }, "Test rule"),
                            React.createElement(Button, { onClick: function () { return _this.onToggleModal('showDeleteConfirmation'); }, variant: "destructive" }, "Delete"))),
                        !alert && !validationMessage && React.createElement(EmptyListCTA, __assign({}, model))))),
            this.renderTestRule(),
            this.renderDeleteConfirmation(),
            this.renderStateHistory()));
    };
    return UnConnectedAlertTab;
}(PureComponent));
var mapStateToProps = function (state, props) {
    var _a;
    return {
        angularPanelComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    };
};
var mapDispatchToProps = {};
export var AlertTab = connect(mapStateToProps, mapDispatchToProps)(UnConnectedAlertTab);
//# sourceMappingURL=AlertTab.js.map
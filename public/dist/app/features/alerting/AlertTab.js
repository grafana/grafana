import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Services & Utils
import { getAngularLoader } from 'app/core/services/AngularLoader';
import appEvents from 'app/core/app_events';
// Components
import { EditorTabBody } from '../dashboard/panel_editor/EditorTabBody';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import StateHistory from './StateHistory';
import 'app/features/alerting/AlertTabCtrl';
import { TestRuleResult } from './TestRuleResult';
var AlertTab = /** @class */ (function (_super) {
    tslib_1.__extends(AlertTab, _super);
    function AlertTab() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.stateHistory = function () {
            return {
                title: 'State history',
                render: function () {
                    return (React.createElement(StateHistory, { dashboard: _this.props.dashboard, panelId: _this.props.panel.id, onRefresh: _this.panelCtrl.refresh }));
                },
            };
        };
        _this.deleteAlert = function () {
            var panel = _this.props.panel;
            return {
                title: 'Delete',
                btnType: 'danger',
                onClick: function () {
                    appEvents.emit('confirm-modal', {
                        title: 'Delete Alert',
                        text: 'Are you sure you want to delete this alert rule?',
                        text2: 'You need to save dashboard for the delete to take effect',
                        icon: 'fa-trash',
                        yesText: 'Delete',
                        onConfirm: function () {
                            delete panel.alert;
                            panel.thresholds = [];
                            _this.panelCtrl.alertState = null;
                            _this.panelCtrl.render();
                            _this.forceUpdate();
                        },
                    });
                },
            };
        };
        _this.renderTestRuleResult = function () {
            var _a = _this.props, panel = _a.panel, dashboard = _a.dashboard;
            return React.createElement(TestRuleResult, { panelId: panel.id, dashboard: dashboard });
        };
        _this.testRule = function () { return ({
            title: 'Test Rule',
            render: function () { return _this.renderTestRuleResult(); },
        }); };
        _this.onAddAlert = function () {
            _this.panelCtrl._enableAlert();
            _this.component.digest();
            _this.forceUpdate();
        };
        return _this;
    }
    AlertTab.prototype.componentDidMount = function () {
        if (this.shouldLoadAlertTab()) {
            this.loadAlertTab();
        }
    };
    AlertTab.prototype.componentDidUpdate = function (prevProps) {
        if (this.shouldLoadAlertTab()) {
            this.loadAlertTab();
        }
    };
    AlertTab.prototype.shouldLoadAlertTab = function () {
        return this.props.angularPanel && this.element && !this.component;
    };
    AlertTab.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    AlertTab.prototype.loadAlertTab = function () {
        var _this = this;
        var angularPanel = this.props.angularPanel;
        var scope = angularPanel.getScope();
        // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
        if (!scope.$$childHead) {
            setTimeout(function () {
                _this.forceUpdate();
            });
            return;
        }
        this.panelCtrl = scope.$$childHead.ctrl;
        var loader = getAngularLoader();
        var template = '<alert-tab />';
        var scopeProps = { ctrl: this.panelCtrl };
        this.component = loader.load(this.element, scopeProps, template);
    };
    AlertTab.prototype.render = function () {
        var _this = this;
        var alert = this.props.panel.alert;
        var toolbarItems = alert ? [this.stateHistory(), this.testRule(), this.deleteAlert()] : [];
        var model = {
            title: 'Panel has no alert rule defined',
            icon: 'icon-gf icon-gf-alert',
            onClick: this.onAddAlert,
            buttonTitle: 'Create Alert',
        };
        return (React.createElement(EditorTabBody, { heading: "Alert", toolbarItems: toolbarItems },
            React.createElement(React.Fragment, null,
                React.createElement("div", { ref: function (element) { return (_this.element = element); } }),
                !alert && React.createElement(EmptyListCTA, { model: model }))));
    };
    return AlertTab;
}(PureComponent));
export { AlertTab };
//# sourceMappingURL=AlertTab.js.map
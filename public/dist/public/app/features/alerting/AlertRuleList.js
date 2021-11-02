import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import AlertRuleItem from './AlertRuleItem';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { getAlertRulesAsync, togglePauseAlertRule } from './state/actions';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';
import { config, locationService } from '@grafana/runtime';
import { setSearchQuery } from './state/reducers';
import { Button, LinkButton, Select, VerticalGroup, FilterInput } from '@grafana/ui';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'alert-list'),
        alertRules: getAlertRuleItems(state),
        search: getSearchQuery(state.alertRules),
        isLoading: state.alertRules.isLoading,
    };
}
var mapDispatchToProps = {
    getAlertRulesAsync: getAlertRulesAsync,
    setSearchQuery: setSearchQuery,
    togglePauseAlertRule: togglePauseAlertRule,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var AlertRuleListUnconnected = /** @class */ (function (_super) {
    __extends(AlertRuleListUnconnected, _super);
    function AlertRuleListUnconnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.stateFilters = [
            { label: 'All', value: 'all' },
            { label: 'OK', value: 'ok' },
            { label: 'Not OK', value: 'not_ok' },
            { label: 'Alerting', value: 'alerting' },
            { label: 'No data', value: 'no_data' },
            { label: 'Paused', value: 'paused' },
            { label: 'Pending', value: 'pending' },
        ];
        _this.onStateFilterChanged = function (option) {
            locationService.partial({ state: option.value });
        };
        _this.onOpenHowTo = function () {
            appEvents.publish(new ShowModalReactEvent({ component: AlertHowToModal }));
        };
        _this.onSearchQueryChange = function (value) {
            _this.props.setSearchQuery(value);
        };
        _this.onTogglePause = function (rule) {
            _this.props.togglePauseAlertRule(rule.id, { paused: rule.state !== 'paused' });
        };
        _this.alertStateFilterOption = function (_a) {
            var text = _a.text, value = _a.value;
            return (React.createElement("option", { key: value, value: value }, text));
        };
        return _this;
    }
    AlertRuleListUnconnected.prototype.componentDidMount = function () {
        this.fetchRules();
    };
    AlertRuleListUnconnected.prototype.componentDidUpdate = function (prevProps) {
        if (prevProps.queryParams.state !== this.props.queryParams.state) {
            this.fetchRules();
        }
    };
    AlertRuleListUnconnected.prototype.fetchRules = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.getAlertRulesAsync({ state: this.getStateFilter() })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AlertRuleListUnconnected.prototype.getStateFilter = function () {
        var _a;
        return (_a = this.props.queryParams.state) !== null && _a !== void 0 ? _a : 'all';
    };
    AlertRuleListUnconnected.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, alertRules = _a.alertRules, search = _a.search, isLoading = _a.isLoading;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "gf-form gf-form--grow" },
                        React.createElement(FilterInput, { placeholder: "Search alerts", value: search, onChange: this.onSearchQueryChange })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("label", { className: "gf-form-label" }, "States"),
                        React.createElement("div", { className: "width-13" },
                            React.createElement(Select, { menuShouldPortal: true, options: this.stateFilters, onChange: this.onStateFilterChanged, value: this.getStateFilter() }))),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    config.unifiedAlertingEnabled && (React.createElement(LinkButton, { variant: "primary", href: "alerting/ng/new" }, "Add NG Alert")),
                    React.createElement(Button, { variant: "secondary", onClick: this.onOpenHowTo }, "How to add an alert")),
                React.createElement(VerticalGroup, { spacing: "none" }, alertRules.map(function (rule) {
                    return (React.createElement(AlertRuleItem, { rule: rule, key: rule.id, search: search, onTogglePause: function () { return _this.onTogglePause(rule); } }));
                })))));
    };
    return AlertRuleListUnconnected;
}(PureComponent));
export { AlertRuleListUnconnected };
export default connector(AlertRuleListUnconnected);
//# sourceMappingURL=AlertRuleList.js.map
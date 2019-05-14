import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import AlertRuleItem from './AlertRuleItem';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getAlertRulesAsync, setSearchQuery, togglePauseAlertRule } from './state/actions';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var AlertRuleList = /** @class */ (function (_super) {
    tslib_1.__extends(AlertRuleList, _super);
    function AlertRuleList() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.stateFilters = [
            { text: 'All', value: 'all' },
            { text: 'OK', value: 'ok' },
            { text: 'Not OK', value: 'not_ok' },
            { text: 'Alerting', value: 'alerting' },
            { text: 'No Data', value: 'no_data' },
            { text: 'Paused', value: 'paused' },
            { text: 'Pending', value: 'pending' },
        ];
        _this.onStateFilterChanged = function (evt) {
            _this.props.updateLocation({
                query: { state: evt.target.value },
            });
        };
        _this.onOpenHowTo = function () {
            appEvents.emit('show-modal', {
                src: 'public/app/features/alerting/partials/alert_howto.html',
                modalClass: 'confirm-modal',
                model: {},
            });
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
    AlertRuleList.prototype.componentDidMount = function () {
        this.fetchRules();
    };
    AlertRuleList.prototype.componentDidUpdate = function (prevProps) {
        if (prevProps.stateFilter !== this.props.stateFilter) {
            this.fetchRules();
        }
    };
    AlertRuleList.prototype.fetchRules = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.getAlertRulesAsync({ state: this.getStateFilter() })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AlertRuleList.prototype.getStateFilter = function () {
        var stateFilter = this.props.stateFilter;
        if (stateFilter) {
            return stateFilter.toString();
        }
        return 'all';
    };
    AlertRuleList.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, alertRules = _a.alertRules, search = _a.search, isLoading = _a.isLoading;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "gf-form gf-form--grow" },
                        React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon gf-form--grow", inputClassName: "gf-form-input", placeholder: "Search alerts", value: search, onChange: this.onSearchQueryChange })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("label", { className: "gf-form-label" }, "States"),
                        React.createElement("div", { className: "gf-form-select-wrapper width-13" },
                            React.createElement("select", { className: "gf-form-input", onChange: this.onStateFilterChanged, value: this.getStateFilter() }, this.stateFilters.map(this.alertStateFilterOption)))),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement("a", { className: "btn btn-secondary", onClick: this.onOpenHowTo },
                        React.createElement("i", { className: "fa fa-info-circle" }),
                        " How to add an alert")),
                React.createElement("section", null,
                    React.createElement("ol", { className: "alert-rule-list" }, alertRules.map(function (rule) { return (React.createElement(AlertRuleItem, { rule: rule, key: rule.id, search: search, onTogglePause: function () { return _this.onTogglePause(rule); } })); }))))));
    };
    return AlertRuleList;
}(PureComponent));
export { AlertRuleList };
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'alert-list'),
    alertRules: getAlertRuleItems(state.alertRules),
    stateFilter: state.location.query.state,
    search: getSearchQuery(state.alertRules),
    isLoading: state.alertRules.isLoading,
}); };
var mapDispatchToProps = {
    updateLocation: updateLocation,
    getAlertRulesAsync: getAlertRulesAsync,
    setSearchQuery: setSearchQuery,
    togglePauseAlertRule: togglePauseAlertRule,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(AlertRuleList));
//# sourceMappingURL=AlertRuleList.js.map
import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { config, locationService } from '@grafana/runtime';
import { Button, FilterInput, LinkButton, Select, VerticalGroup } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';
import AlertRuleItem from './AlertRuleItem';
import { DeprecationNotice } from './components/DeprecationNotice';
import { getAlertRulesAsync, togglePauseAlertRule } from './state/actions';
import { setSearchQuery } from './state/reducers';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';
function mapStateToProps(state) {
    return {
        alertRules: getAlertRuleItems(state),
        search: getSearchQuery(state.alertRules),
        isLoading: state.alertRules.isLoading,
    };
}
const mapDispatchToProps = {
    getAlertRulesAsync,
    setSearchQuery,
    togglePauseAlertRule,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class AlertRuleListUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.stateFilters = [
            { label: 'All', value: 'all' },
            { label: 'OK', value: 'ok' },
            { label: 'Not OK', value: 'not_ok' },
            { label: 'Alerting', value: 'alerting' },
            { label: 'No data', value: 'no_data' },
            { label: 'Paused', value: 'paused' },
            { label: 'Pending', value: 'pending' },
        ];
        this.onStateFilterChanged = (option) => {
            locationService.partial({ state: option.value });
        };
        this.onOpenHowTo = () => {
            appEvents.publish(new ShowModalReactEvent({ component: AlertHowToModal }));
        };
        this.onSearchQueryChange = (value) => {
            this.props.setSearchQuery(value);
        };
        this.onTogglePause = (rule) => {
            this.props.togglePauseAlertRule(rule.id, { paused: rule.state !== 'paused' });
        };
        this.alertStateFilterOption = ({ text, value }) => {
            return (React.createElement("option", { key: value, value: value }, text));
        };
    }
    componentDidMount() {
        this.fetchRules();
    }
    componentDidUpdate(prevProps) {
        if (prevProps.queryParams.state !== this.props.queryParams.state) {
            this.fetchRules();
        }
    }
    fetchRules() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.getAlertRulesAsync({ state: this.getStateFilter() });
        });
    }
    getStateFilter() {
        var _a;
        return (_a = this.props.queryParams.state) !== null && _a !== void 0 ? _a : 'all';
    }
    render() {
        const { alertRules, search, isLoading } = this.props;
        return (React.createElement(Page, { navId: "alert-list" },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "gf-form gf-form--grow" },
                        React.createElement(FilterInput, { placeholder: "Search alerts", value: search, onChange: this.onSearchQueryChange })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("label", { className: "gf-form-label", htmlFor: "alert-state-filter" }, "States"),
                        React.createElement("div", { className: "width-13" },
                            React.createElement(Select, { inputId: 'alert-state-filter', options: this.stateFilters, onChange: this.onStateFilterChanged, value: this.getStateFilter() }))),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    config.unifiedAlertingEnabled && (React.createElement(LinkButton, { variant: "primary", href: "alerting/ng/new" }, "Add NG Alert")),
                    React.createElement(Button, { variant: "secondary", onClick: this.onOpenHowTo }, "How to add an alert")),
                React.createElement(DeprecationNotice, null),
                React.createElement(VerticalGroup, { spacing: "none" }, alertRules.map((rule) => {
                    return (React.createElement(AlertRuleItem, { rule: rule, key: rule.id, search: search, onTogglePause: () => this.onTogglePause(rule) }));
                })))));
    }
}
export default connector(AlertRuleListUnconnected);
//# sourceMappingURL=AlertRuleList.js.map
import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Button, Field, Icon, Input, Label, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { LogMessages } from '../../Analytics';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleHealth } from '../../search/rulesSearchParser';
import { alertStateToReadable } from '../../utils/rules';
import { HoverCard } from '../HoverCard';
import { MultipleDataSourcePicker } from './MultipleDataSourcePicker';
const ViewOptions = [
    {
        icon: 'folder',
        label: 'Grouped',
        value: 'grouped',
    },
    {
        icon: 'list-ul',
        label: 'List',
        value: 'list',
    },
    {
        icon: 'heart-rate',
        label: 'State',
        value: 'state',
    },
];
const RuleTypeOptions = [
    {
        label: 'Alert ',
        value: PromRuleType.Alerting,
    },
    {
        label: 'Recording ',
        value: PromRuleType.Recording,
    },
];
const RuleHealthOptions = [
    { label: 'Ok', value: RuleHealth.Ok },
    { label: 'No Data', value: RuleHealth.NoData },
    { label: 'Error', value: RuleHealth.Error },
];
const RuleStateOptions = Object.entries(PromAlertingRuleState).map(([key, value]) => ({
    label: alertStateToReadable(value),
    value,
}));
const RulesFilter = ({ onFilterCleared = () => undefined }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const [queryParams, setQueryParams] = useQueryParams();
    const { filterState, hasActiveFilters, searchQuery, setSearchQuery, updateFilters } = useRulesFilter();
    // This key is used to force a rerender on the inputs when the filters are cleared
    const [filterKey, setFilterKey] = useState(Math.floor(Math.random() * 100));
    const dataSourceKey = `dataSource-${filterKey}`;
    const queryStringKey = `queryString-${filterKey}`;
    const searchQueryRef = useRef(null);
    const { handleSubmit, register, setValue } = useForm({ defaultValues: { searchQuery } });
    const _b = register('searchQuery'), { ref } = _b, rest = __rest(_b, ["ref"]);
    useEffect(() => {
        setValue('searchQuery', searchQuery);
    }, [searchQuery, setValue]);
    const handleDataSourceChange = (dataSourceValue, action) => {
        const dataSourceNames = action === 'add'
            ? [...filterState.dataSourceNames].concat([dataSourceValue.name])
            : filterState.dataSourceNames.filter((name) => name !== dataSourceValue.name);
        updateFilters(Object.assign(Object.assign({}, filterState), { dataSourceNames }));
        setFilterKey((key) => key + 1);
    };
    const clearDataSource = () => {
        updateFilters(Object.assign(Object.assign({}, filterState), { dataSourceNames: [] }));
        setFilterKey((key) => key + 1);
    };
    const handleAlertStateChange = (value) => {
        logInfo(LogMessages.clickingAlertStateFilters);
        updateFilters(Object.assign(Object.assign({}, filterState), { ruleState: value }));
        setFilterKey((key) => key + 1);
    };
    const handleViewChange = (view) => {
        setQueryParams({ view });
    };
    const handleRuleTypeChange = (ruleType) => {
        updateFilters(Object.assign(Object.assign({}, filterState), { ruleType }));
        setFilterKey((key) => key + 1);
    };
    const handleRuleHealthChange = (ruleHealth) => {
        updateFilters(Object.assign(Object.assign({}, filterState), { ruleHealth }));
        setFilterKey((key) => key + 1);
    };
    const handleClearFiltersClick = () => {
        setSearchQuery(undefined);
        onFilterCleared();
        setTimeout(() => setFilterKey(filterKey + 1), 100);
    };
    const searchIcon = React.createElement(Icon, { name: 'search' });
    return (React.createElement("div", { className: styles.container },
        React.createElement(Stack, { direction: "column", gap: 1 },
            React.createElement(Stack, { direction: "row", gap: 1 },
                React.createElement(Field, { className: styles.dsPickerContainer, label: React.createElement(Label, { htmlFor: "data-source-picker" },
                        React.createElement(Stack, { gap: 0.5 },
                            React.createElement("span", null, "Search by data sources"),
                            React.createElement(Tooltip, { content: React.createElement("div", null,
                                    React.createElement("p", null, "Data sources containing configured alert rules are Mimir or Loki data sources where alert rules are stored and evaluated in the data source itself."),
                                    React.createElement("p", null, "In these data sources, you can select Manage alerts via Alerting UI to be able to manage these alert rules in the Grafana UI as well as in the data source where they were configured.")) },
                                React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
                    React.createElement(MultipleDataSourcePicker, { key: dataSourceKey, alerting: true, noDefault: true, placeholder: "All data sources", current: filterState.dataSourceNames, onChange: handleDataSourceChange, onClear: clearDataSource })),
                React.createElement("div", null,
                    React.createElement(Label, null, "State"),
                    React.createElement(RadioButtonGroup, { options: RuleStateOptions, value: filterState.ruleState, onChange: handleAlertStateChange })),
                React.createElement("div", null,
                    React.createElement(Label, null, "Rule type"),
                    React.createElement(RadioButtonGroup, { options: RuleTypeOptions, value: filterState.ruleType, onChange: handleRuleTypeChange })),
                React.createElement("div", null,
                    React.createElement(Label, null, "Health"),
                    React.createElement(RadioButtonGroup, { options: RuleHealthOptions, value: filterState.ruleHealth, onChange: handleRuleHealthChange }))),
            React.createElement(Stack, { direction: "column", gap: 1 },
                React.createElement(Stack, { direction: "row", gap: 1 },
                    React.createElement("form", { className: styles.searchInput, onSubmit: handleSubmit((data) => {
                            var _a;
                            setSearchQuery(data.searchQuery);
                            (_a = searchQueryRef.current) === null || _a === void 0 ? void 0 : _a.blur();
                        }) },
                        React.createElement(Field, { label: React.createElement(Label, { htmlFor: "rulesSearchInput" },
                                React.createElement(Stack, { gap: 0.5 },
                                    React.createElement("span", null, "Search"),
                                    React.createElement(HoverCard, { content: React.createElement(SearchQueryHelp, null) },
                                        React.createElement(Icon, { name: "info-circle", size: "sm", tabIndex: 0 })))) },
                            React.createElement(Input, Object.assign({ id: "rulesSearchInput", key: queryStringKey, prefix: searchIcon, ref: (e) => {
                                    ref(e);
                                    searchQueryRef.current = e;
                                } }, rest, { placeholder: "Search", "data-testid": "search-query-input" }))),
                        React.createElement("input", { type: "submit", hidden: true })),
                    React.createElement("div", null,
                        React.createElement(Label, null, "View as"),
                        React.createElement(RadioButtonGroup, { options: ViewOptions, value: String((_a = queryParams['view']) !== null && _a !== void 0 ? _a : ViewOptions[0].value), onChange: handleViewChange }))),
                hasActiveFilters && (React.createElement("div", null,
                    React.createElement(Button, { fullWidth: false, icon: "times", variant: "secondary", onClick: handleClearFiltersClick }, "Clear filters")))))));
};
const getStyles = (theme) => {
    return {
        container: css `
      margin-bottom: ${theme.spacing(1)};
    `,
        dsPickerContainer: css `
      width: 550px;
      flex-grow: 0;
      margin: 0;
    `,
        searchInput: css `
      flex: 1;
      margin: 0;
    `,
    };
};
function SearchQueryHelp() {
    const styles = useStyles2(helpStyles);
    return (React.createElement("div", null,
        React.createElement("div", null, "Search syntax allows to query alert rules by the parameters defined below."),
        React.createElement("hr", null),
        React.createElement("div", { className: styles.grid },
            React.createElement("div", null, "Filter type"),
            React.createElement("div", null, "Expression"),
            React.createElement(HelpRow, { title: "Datasources", expr: "datasource:mimir datasource:prometheus" }),
            React.createElement(HelpRow, { title: "Folder/Namespace", expr: "namespace:global" }),
            React.createElement(HelpRow, { title: "Group", expr: "group:cpu-usage" }),
            React.createElement(HelpRow, { title: "Rule", expr: 'rule:"cpu 80%"' }),
            React.createElement(HelpRow, { title: "Labels", expr: "label:team=A label:cluster=a1" }),
            React.createElement(HelpRow, { title: "State", expr: "state:firing|normal|pending" }),
            React.createElement(HelpRow, { title: "Type", expr: "type:alerting|recording" }),
            React.createElement(HelpRow, { title: "Health", expr: "health:ok|nodata|error" }))));
}
function HelpRow({ title, expr }) {
    const styles = useStyles2(helpStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null, title),
        React.createElement("code", { className: styles.code }, expr)));
}
const helpStyles = (theme) => ({
    grid: css `
    display: grid;
    grid-template-columns: max-content auto;
    gap: ${theme.spacing(1)};
    align-items: center;
  `,
    code: css `
    display: block;
    text-align: center;
  `,
});
export default RulesFilter;
//# sourceMappingURL=RulesFilter.js.map
import { css } from '@emotion/css';
import { orderBy } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, Select, TagList, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { getQueryParamValue } from 'app/core/utils/query';
import { useDispatch } from 'app/types';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { usePagination } from './hooks/usePagination';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { combineMatcherStrings, labelsMatchMatchers, parseMatchers } from './utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { createViewLink } from './utils/misc';
var SortOrder;
(function (SortOrder) {
    SortOrder["Ascending"] = "alpha-asc";
    SortOrder["Descending"] = "alpha-desc";
})(SortOrder || (SortOrder = {}));
const sortOptions = [
    { label: 'Alphabetically [A-Z]', value: SortOrder.Ascending },
    { label: 'Alphabetically [Z-A]', value: SortOrder.Descending },
];
export const AlertsFolderView = ({ folder }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const onTagClick = (tagName) => {
        const matchersString = combineMatcherStrings(labelFilter, tagName);
        setLabelFilter(matchersString);
    };
    useEffect(() => {
        dispatch(fetchPromRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
        dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
    }, [dispatch]);
    const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
    const { nameFilter, labelFilter, sortOrder, setNameFilter, setLabelFilter, setSortOrder } = useAlertsFolderViewParams();
    const matchingNamespace = combinedNamespaces.find((namespace) => namespace.name === folder.title);
    const alertRules = (_a = matchingNamespace === null || matchingNamespace === void 0 ? void 0 : matchingNamespace.groups.flatMap((group) => group.rules)) !== null && _a !== void 0 ? _a : [];
    const filteredRules = filterAndSortRules(alertRules, nameFilter, labelFilter, sortOrder !== null && sortOrder !== void 0 ? sortOrder : SortOrder.Ascending);
    const hasNoResults = alertRules.length === 0 || filteredRules.length === 0;
    const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, DEFAULT_PER_PAGE_PAGINATION);
    return (React.createElement("div", { className: styles.container },
        React.createElement(Stack, { direction: "column", gap: 3 },
            React.createElement(FilterInput, { value: nameFilter, onChange: setNameFilter, placeholder: "Search alert rules by name", "data-testid": "name-filter" }),
            React.createElement(Stack, { direction: "row" },
                React.createElement(Select, { value: sortOrder, onChange: ({ value }) => value && setSortOrder(value), options: sortOptions, width: 25, "aria-label": "Sort", placeholder: `Sort (Default A-Z)`, prefix: React.createElement(Icon, { name: sortOrder === SortOrder.Ascending ? 'sort-amount-up' : 'sort-amount-down' }) }),
                React.createElement(FilterInput, { value: labelFilter, onChange: setLabelFilter, placeholder: "Search alerts by labels", className: styles.filterLabelsInput, "data-testid": "label-filter" })),
            React.createElement(Stack, { gap: 1 }, pageItems.map((currentRule) => (React.createElement(Card, { key: currentRule.name, href: createViewLink('grafana', currentRule, ''), className: styles.card, "data-testid": "alert-card-row" },
                React.createElement(Card.Heading, null, currentRule.name),
                React.createElement(Card.Tags, null,
                    React.createElement(TagList, { onClick: onTagClick, tags: Object.entries(currentRule.labels).map(([label, value]) => `${label}=${value}`) })),
                React.createElement(Card.Meta, null,
                    React.createElement("div", null,
                        React.createElement(Icon, { name: "folder" }),
                        " ",
                        folder.title)))))),
            hasNoResults && React.createElement("div", { className: styles.noResults }, "No alert rules found"),
            React.createElement("div", { className: styles.pagination },
                React.createElement(Pagination, { currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true })))));
};
var AlertFolderViewParams;
(function (AlertFolderViewParams) {
    AlertFolderViewParams["nameFilter"] = "nameFilter";
    AlertFolderViewParams["labelFilter"] = "labelFilter";
    AlertFolderViewParams["sortOrder"] = "sort";
})(AlertFolderViewParams || (AlertFolderViewParams = {}));
function useAlertsFolderViewParams() {
    var _a, _b;
    const [searchParams, setSearchParams] = useURLSearchParams();
    const [nameFilter, setNameFilter] = useState((_a = searchParams.get(AlertFolderViewParams.nameFilter)) !== null && _a !== void 0 ? _a : '');
    const [labelFilter, setLabelFilter] = useState((_b = searchParams.get(AlertFolderViewParams.labelFilter)) !== null && _b !== void 0 ? _b : '');
    const sortParam = searchParams.get(AlertFolderViewParams.sortOrder);
    const [sortOrder, setSortOrder] = useState(sortParam === SortOrder.Ascending
        ? SortOrder.Ascending
        : sortParam === SortOrder.Descending
            ? SortOrder.Descending
            : undefined);
    useDebounce(() => setSearchParams({
        [AlertFolderViewParams.nameFilter]: getQueryParamValue(nameFilter),
        [AlertFolderViewParams.labelFilter]: getQueryParamValue(labelFilter),
        [AlertFolderViewParams.sortOrder]: getQueryParamValue(sortOrder),
    }, true), 400, [nameFilter, labelFilter, sortOrder]);
    return { nameFilter, labelFilter, sortOrder, setNameFilter, setLabelFilter, setSortOrder };
}
function filterAndSortRules(originalRules, nameFilter, labelFilter, sortOrder) {
    const matchers = parseMatchers(labelFilter);
    let rules = originalRules.filter((rule) => rule.name.toLowerCase().includes(nameFilter.toLowerCase()) && labelsMatchMatchers(rule.labels, matchers));
    return orderBy(rules, (x) => x.name.toLowerCase(), [sortOrder === SortOrder.Ascending ? 'asc' : 'desc']);
}
export const getStyles = (theme) => ({
    container: css `
    padding: ${theme.spacing(1)};
  `,
    card: css `
    grid-template-columns: auto 1fr 2fr;
    margin: 0;
  `,
    pagination: css `
    align-self: center;
  `,
    filterLabelsInput: css `
    flex: 1;
    width: auto;
    min-width: 240px;
  `,
    noResults: css `
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    font-style: italic;
  `,
});
//# sourceMappingURL=AlertsFolderView.js.map
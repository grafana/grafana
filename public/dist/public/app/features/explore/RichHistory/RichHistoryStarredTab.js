import { __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { uniqBy } from 'lodash';
// Utils
import { stylesFactory, useTheme, Select, MultiSelect, FilterInput } from '@grafana/ui';
import { filterAndSortQueries, createDatasourcesList } from 'app/core/utils/richHistory';
// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { useDebounce } from 'react-use';
var getStyles = stylesFactory(function (theme) {
    var bgColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark4;
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        containerContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 100%;\n    "], ["\n      width: 100%;\n    "]))),
        selectors: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "]))),
        multiselect: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 100%;\n      margin-bottom: ", ";\n      .gf-form-select-box__multi-value {\n        background-color: ", ";\n        padding: ", " ", " ", " ", ";\n        border-radius: ", ";\n      }\n    "], ["\n      width: 100%;\n      margin-bottom: ", ";\n      .gf-form-select-box__multi-value {\n        background-color: ", ";\n        padding: ", " ", " ", " ", ";\n        border-radius: ", ";\n      }\n    "])), theme.spacing.sm, bgColor, theme.spacing.xxs, theme.spacing.xs, theme.spacing.xxs, theme.spacing.sm, theme.border.radius.sm),
        filterInput: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.sm),
        sort: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      width: 170px;\n    "], ["\n      width: 170px;\n    "]))),
        footer: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      height: 60px;\n      margin-top: ", ";\n      display: flex;\n      justify-content: center;\n      font-weight: ", ";\n      font-size: ", ";\n      a {\n        font-weight: ", ";\n        margin-left: ", ";\n      }\n    "], ["\n      height: 60px;\n      margin-top: ", ";\n      display: flex;\n      justify-content: center;\n      font-weight: ", ";\n      font-size: ", ";\n      a {\n        font-weight: ", ";\n        margin-left: ", ";\n      }\n    "])), theme.spacing.lg, theme.typography.weight.light, theme.typography.size.sm, theme.typography.weight.semibold, theme.spacing.xxs),
    };
});
export function RichHistoryStarredTab(props) {
    var datasourceFilters = props.datasourceFilters, onSelectDatasourceFilters = props.onSelectDatasourceFilters, queries = props.queries, onChangeSortOrder = props.onChangeSortOrder, sortOrder = props.sortOrder, activeDatasourceOnly = props.activeDatasourceOnly, exploreId = props.exploreId;
    var _a = __read(useState([]), 2), filteredQueries = _a[0], setFilteredQueries = _a[1];
    var _b = __read(useState(''), 2), searchInput = _b[0], setSearchInput = _b[1];
    var _c = __read(useState(''), 2), debouncedSearchInput = _c[0], setDebouncedSearchInput = _c[1];
    var theme = useTheme();
    var styles = getStyles(theme);
    var datasourcesRetrievedFromQueryHistory = uniqBy(queries, 'datasourceName').map(function (d) { return d.datasourceName; });
    var listOfDatasources = createDatasourcesList(datasourcesRetrievedFromQueryHistory);
    useDebounce(function () {
        setDebouncedSearchInput(searchInput);
    }, 300, [searchInput]);
    useEffect(function () {
        var starredQueries = queries.filter(function (q) { return q.starred === true; });
        setFilteredQueries(filterAndSortQueries(starredQueries, sortOrder, datasourceFilters.map(function (d) { return d.value; }), debouncedSearchInput));
    }, [queries, sortOrder, datasourceFilters, debouncedSearchInput]);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.containerContent },
            React.createElement("div", { className: styles.selectors },
                !activeDatasourceOnly && (React.createElement("div", { "aria-label": "Filter datasources", className: styles.multiselect },
                    React.createElement(MultiSelect, { menuShouldPortal: true, options: listOfDatasources, value: datasourceFilters, placeholder: "Filter queries for specific data sources(s)", onChange: onSelectDatasourceFilters }))),
                React.createElement("div", { className: styles.filterInput },
                    React.createElement(FilterInput, { placeholder: "Search queries", value: searchInput, onChange: function (value) {
                            setSearchInput(value);
                        } })),
                React.createElement("div", { "aria-label": "Sort queries", className: styles.sort },
                    React.createElement(Select, { menuShouldPortal: true, options: sortOrderOptions, value: sortOrderOptions.filter(function (order) { return order.value === sortOrder; }), placeholder: "Sort queries by", onChange: function (e) { return onChangeSortOrder(e.value); } }))),
            filteredQueries.map(function (q) {
                var idx = listOfDatasources.findIndex(function (d) { return d.label === q.datasourceName; });
                return (React.createElement(RichHistoryCard, { query: q, key: q.ts, exploreId: exploreId, dsImg: listOfDatasources[idx].imgUrl, isRemoved: listOfDatasources[idx].isRemoved }));
            }),
            React.createElement("div", { className: styles.footer }, "The history is local to your browser and is not shared with others."))));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=RichHistoryStarredTab.js.map
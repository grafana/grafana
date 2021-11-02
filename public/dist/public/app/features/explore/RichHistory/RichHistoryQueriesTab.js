import { __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { uniqBy } from 'lodash';
// Utils
import { stylesFactory, useTheme, RangeSlider, MultiSelect, Select, FilterInput } from '@grafana/ui';
import { mapNumbertoTimeInSlider, mapQueriesToHeadings, createDatasourcesList, filterAndSortQueries, } from 'app/core/utils/richHistory';
// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { useDebounce } from 'react-use';
var getStyles = stylesFactory(function (theme, height) {
    var bgColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark4;
    /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
    var cardWidth = '100% - 134px';
    var sliderHeight = height - 180 + "px";
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      .label-slider {\n        font-size: ", ";\n        &:last-of-type {\n          margin-top: ", ";\n        }\n        &:first-of-type {\n          font-weight: ", ";\n          margin-bottom: ", ";\n        }\n      }\n    "], ["\n      display: flex;\n      .label-slider {\n        font-size: ", ";\n        &:last-of-type {\n          margin-top: ", ";\n        }\n        &:first-of-type {\n          font-weight: ", ";\n          margin-bottom: ", ";\n        }\n      }\n    "])), theme.typography.size.sm, theme.spacing.lg, theme.typography.weight.semibold, theme.spacing.md),
        containerContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: calc(", ");\n    "], ["\n      width: calc(", ");\n    "])), cardWidth),
        containerSlider: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      width: 129px;\n      margin-right: ", ";\n      .slider {\n        bottom: 10px;\n        height: ", ";\n        width: 129px;\n        padding: ", " 0;\n      }\n    "], ["\n      width: 129px;\n      margin-right: ", ";\n      .slider {\n        bottom: 10px;\n        height: ", ";\n        width: 129px;\n        padding: ", " 0;\n      }\n    "])), theme.spacing.sm, sliderHeight, theme.spacing.sm),
        slider: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      position: fixed;\n    "], ["\n      position: fixed;\n    "]))),
        selectors: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "]))),
        filterInput: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.sm),
        multiselect: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      width: 100%;\n      margin-bottom: ", ";\n      .gf-form-select-box__multi-value {\n        background-color: ", ";\n        padding: ", " ", " ", " ", ";\n        border-radius: ", ";\n      }\n    "], ["\n      width: 100%;\n      margin-bottom: ", ";\n      .gf-form-select-box__multi-value {\n        background-color: ", ";\n        padding: ", " ", " ", " ", ";\n        border-radius: ", ";\n      }\n    "])), theme.spacing.sm, bgColor, theme.spacing.xxs, theme.spacing.xs, theme.spacing.xxs, theme.spacing.sm, theme.border.radius.sm),
        sort: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      width: 170px;\n    "], ["\n      width: 170px;\n    "]))),
        sessionName: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      align-items: flex-start;\n      justify-content: flex-start;\n      margin-top: ", ";\n      h4 {\n        margin: 0 10px 0 0;\n      }\n    "], ["\n      display: flex;\n      align-items: flex-start;\n      justify-content: flex-start;\n      margin-top: ", ";\n      h4 {\n        margin: 0 10px 0 0;\n      }\n    "])), theme.spacing.lg),
        heading: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      font-size: ", ";\n      margin: ", " ", " ", " ", ";\n    "], ["\n      font-size: ", ";\n      margin: ", " ", " ", " ", ";\n    "])), theme.typography.heading.h4, theme.spacing.md, theme.spacing.xxs, theme.spacing.sm, theme.spacing.xxs),
        footer: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      height: 60px;\n      margin: ", " auto;\n      display: flex;\n      justify-content: center;\n      font-weight: ", ";\n      font-size: ", ";\n      a {\n        font-weight: ", ";\n        margin-left: ", ";\n      }\n    "], ["\n      height: 60px;\n      margin: ", " auto;\n      display: flex;\n      justify-content: center;\n      font-weight: ", ";\n      font-size: ", ";\n      a {\n        font-weight: ", ";\n        margin-left: ", ";\n      }\n    "])), theme.spacing.lg, theme.typography.weight.light, theme.typography.size.sm, theme.typography.weight.semibold, theme.spacing.xxs),
        queries: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n      margin-left: ", ";\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n      margin-left: ", ";\n    "])), theme.typography.size.sm, theme.typography.weight.regular, theme.spacing.xs),
    };
});
export function RichHistoryQueriesTab(props) {
    var datasourceFilters = props.datasourceFilters, onSelectDatasourceFilters = props.onSelectDatasourceFilters, queries = props.queries, onChangeSortOrder = props.onChangeSortOrder, sortOrder = props.sortOrder, activeDatasourceOnly = props.activeDatasourceOnly, retentionPeriod = props.retentionPeriod, exploreId = props.exploreId, height = props.height;
    var _a = __read(useState([0, retentionPeriod]), 2), timeFilter = _a[0], setTimeFilter = _a[1];
    var _b = __read(useState([]), 2), filteredQueries = _b[0], setFilteredQueries = _b[1];
    var _c = __read(useState(''), 2), searchInput = _c[0], setSearchInput = _c[1];
    var _d = __read(useState(''), 2), debouncedSearchInput = _d[0], setDebouncedSearchInput = _d[1];
    var theme = useTheme();
    var styles = getStyles(theme, height);
    var datasourcesRetrievedFromQueryHistory = uniqBy(queries, 'datasourceName').map(function (d) { return d.datasourceName; });
    var listOfDatasources = createDatasourcesList(datasourcesRetrievedFromQueryHistory);
    useDebounce(function () {
        setDebouncedSearchInput(searchInput);
    }, 300, [searchInput]);
    useEffect(function () {
        setFilteredQueries(filterAndSortQueries(queries, sortOrder, datasourceFilters.map(function (d) { return d.value; }), debouncedSearchInput, timeFilter));
    }, [timeFilter, queries, sortOrder, datasourceFilters, debouncedSearchInput]);
    /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
     * are keys and arrays with queries that belong to that headings are values.
     */
    var mappedQueriesToHeadings = mapQueriesToHeadings(filteredQueries, sortOrder);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.containerSlider },
            React.createElement("div", { className: styles.slider },
                React.createElement("div", { className: "label-slider" }, "Filter history"),
                React.createElement("div", { className: "label-slider" }, mapNumbertoTimeInSlider(timeFilter[0])),
                React.createElement("div", { className: "slider" },
                    React.createElement(RangeSlider, { tooltipAlwaysVisible: false, min: 0, max: retentionPeriod, value: timeFilter, orientation: "vertical", formatTooltipResult: mapNumbertoTimeInSlider, reverse: true, onAfterChange: setTimeFilter })),
                React.createElement("div", { className: "label-slider" }, mapNumbertoTimeInSlider(timeFilter[1])))),
        React.createElement("div", { className: styles.containerContent },
            React.createElement("div", { className: styles.selectors },
                !activeDatasourceOnly && (React.createElement("div", { "aria-label": "Filter datasources", className: styles.multiselect },
                    React.createElement(MultiSelect, { menuShouldPortal: true, options: listOfDatasources, value: datasourceFilters, placeholder: "Filter queries for data sources(s)", onChange: onSelectDatasourceFilters }))),
                React.createElement("div", { className: styles.filterInput },
                    React.createElement(FilterInput, { placeholder: "Search queries", value: searchInput, onChange: function (value) {
                            setSearchInput(value);
                        } })),
                React.createElement("div", { "aria-label": "Sort queries", className: styles.sort },
                    React.createElement(Select, { menuShouldPortal: true, value: sortOrderOptions.filter(function (order) { return order.value === sortOrder; }), options: sortOrderOptions, placeholder: "Sort queries by", onChange: function (e) { return onChangeSortOrder(e.value); } }))),
            Object.keys(mappedQueriesToHeadings).map(function (heading) {
                return (React.createElement("div", { key: heading },
                    React.createElement("div", { className: styles.heading },
                        heading,
                        " ",
                        React.createElement("span", { className: styles.queries },
                            mappedQueriesToHeadings[heading].length,
                            " queries")),
                    mappedQueriesToHeadings[heading].map(function (q) {
                        var idx = listOfDatasources.findIndex(function (d) { return d.label === q.datasourceName; });
                        return (React.createElement(RichHistoryCard, { query: q, key: q.ts, exploreId: exploreId, dsImg: listOfDatasources[idx].imgUrl, isRemoved: listOfDatasources[idx].isRemoved }));
                    })));
            }),
            React.createElement("div", { className: styles.footer }, "The history is local to your browser and is not shared with others."))));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
//# sourceMappingURL=RichHistoryQueriesTab.js.map
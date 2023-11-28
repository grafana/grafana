import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { config } from '@grafana/runtime';
import { Button, FilterInput, MultiSelect, RangeSlider, Select, useStyles2 } from '@grafana/ui';
import { createDatasourcesList, mapNumbertoTimeInSlider, mapQueriesToHeadings, SortOrder, } from 'app/core/utils/richHistory';
import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';
const getStyles = (theme, height) => {
    return {
        container: css `
      display: flex;
    `,
        labelSlider: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      &:last-of-type {
        margin-top: ${theme.spacing(3)};
      }
      &:first-of-type {
        font-weight: ${theme.typography.fontWeightMedium};
        margin-bottom: ${theme.spacing(2)};
      }
    `,
        containerContent: css `
      /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
      width: calc(100% - 134px);
    `,
        containerSlider: css `
      width: 129px;
      margin-right: ${theme.spacing(1)};
    `,
        fixedSlider: css `
      position: fixed;
    `,
        slider: css `
      bottom: 10px;
      height: ${height - 180}px;
      width: 129px;
      padding: ${theme.spacing(1)} 0;
    `,
        selectors: css `
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    `,
        filterInput: css `
      margin-bottom: ${theme.spacing(1)};
    `,
        multiselect: css `
      width: 100%;
      margin-bottom: ${theme.spacing(1)};
    `,
        sort: css `
      width: 170px;
    `,
        sessionName: css `
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-top: ${theme.spacing(3)};
      h4 {
        margin: 0 10px 0 0;
      }
    `,
        heading: css `
      font-size: ${theme.typography.h4.fontSize};
      margin: ${theme.spacing(2, 0.25, 1, 0.25)};
    `,
        footer: css `
      height: 60px;
      margin: ${theme.spacing(3)} auto;
      display: flex;
      justify-content: center;
      font-weight: ${theme.typography.fontWeightLight};
      font-size: ${theme.typography.bodySmall.fontSize};
      a {
        font-weight: ${theme.typography.fontWeightMedium};
        margin-left: ${theme.spacing(0.25)};
      }
    `,
        queries: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightRegular};
      margin-left: ${theme.spacing(0.5)};
    `,
    };
};
export function RichHistoryQueriesTab(props) {
    const { queries, totalQueries, loading, richHistorySearchFilters, updateFilters, clearRichHistoryResults, loadMoreRichHistory, richHistorySettings, exploreId, height, activeDatasourceInstance, } = props;
    const styles = useStyles2(getStyles, height);
    const listOfDatasources = createDatasourcesList();
    useEffect(() => {
        const datasourceFilters = !richHistorySettings.activeDatasourceOnly && richHistorySettings.lastUsedDatasourceFilters
            ? richHistorySettings.lastUsedDatasourceFilters
            : [activeDatasourceInstance];
        const filters = {
            search: '',
            sortOrder: SortOrder.Descending,
            datasourceFilters,
            from: 0,
            to: richHistorySettings.retentionPeriod,
            starred: false,
        };
        updateFilters(filters);
        return () => {
            clearRichHistoryResults();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!richHistorySearchFilters) {
        return React.createElement("span", null, "Loading...");
    }
    /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
     * are keys and arrays with queries that belong to that headings are values.
     */
    const mappedQueriesToHeadings = mapQueriesToHeadings(queries, richHistorySearchFilters.sortOrder);
    const sortOrderOptions = getSortOrderOptions();
    const partialResults = queries.length && queries.length !== totalQueries;
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.containerSlider },
            React.createElement("div", { className: styles.fixedSlider },
                React.createElement("div", { className: styles.labelSlider }, "Filter history"),
                React.createElement("div", { className: styles.labelSlider }, mapNumbertoTimeInSlider(richHistorySearchFilters.from)),
                React.createElement("div", { className: styles.slider },
                    React.createElement(RangeSlider, { tooltipAlwaysVisible: false, min: 0, max: richHistorySettings.retentionPeriod, value: [richHistorySearchFilters.from, richHistorySearchFilters.to], orientation: "vertical", formatTooltipResult: mapNumbertoTimeInSlider, reverse: true, onAfterChange: (value) => {
                            updateFilters({ from: value[0], to: value[1] });
                        } })),
                React.createElement("div", { className: styles.labelSlider }, mapNumbertoTimeInSlider(richHistorySearchFilters.to)))),
        React.createElement("div", { className: styles.containerContent, "data-testid": "query-history-queries-tab" },
            React.createElement("div", { className: styles.selectors },
                !richHistorySettings.activeDatasourceOnly && (React.createElement(MultiSelect, { className: styles.multiselect, options: listOfDatasources.map((ds) => {
                        return { value: ds.name, label: ds.name };
                    }), value: richHistorySearchFilters.datasourceFilters, placeholder: "Filter queries for data sources(s)", "aria-label": "Filter queries for data sources(s)", onChange: (options) => {
                        updateFilters({ datasourceFilters: options.map((option) => option.value) });
                    } })),
                React.createElement("div", { className: styles.filterInput },
                    React.createElement(FilterInput, { escapeRegex: false, placeholder: "Search queries", value: richHistorySearchFilters.search, onChange: (search) => updateFilters({ search }) })),
                React.createElement("div", { "aria-label": "Sort queries", className: styles.sort },
                    React.createElement(Select, { value: sortOrderOptions.filter((order) => order.value === richHistorySearchFilters.sortOrder), options: sortOrderOptions, placeholder: "Sort queries by", onChange: (e) => updateFilters({ sortOrder: e.value }) }))),
            loading && React.createElement("span", null, "Loading results..."),
            !loading &&
                Object.keys(mappedQueriesToHeadings).map((heading) => {
                    return (React.createElement("div", { key: heading },
                        React.createElement("div", { className: styles.heading },
                            heading,
                            ' ',
                            React.createElement("span", { className: styles.queries },
                                partialResults ? 'Displaying ' : '',
                                mappedQueriesToHeadings[heading].length,
                                " queries")),
                        mappedQueriesToHeadings[heading].map((q) => {
                            return React.createElement(RichHistoryCard, { query: q, key: q.id, exploreId: exploreId });
                        })));
                }),
            partialResults ? (React.createElement("div", null,
                "Showing ",
                queries.length,
                " of ",
                totalQueries,
                " ",
                React.createElement(Button, { onClick: loadMoreRichHistory }, "Load more"))) : null,
            React.createElement("div", { className: styles.footer }, !config.queryHistoryEnabled ? 'The history is local to your browser and is not shared with others.' : ''))));
}
//# sourceMappingURL=RichHistoryQueriesTab.js.map
import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { config } from '@grafana/runtime';
import { useStyles2, Select, MultiSelect, FilterInput, Button } from '@grafana/ui';
import { createDatasourcesList, SortOrder, } from 'app/core/utils/richHistory';
import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';
const getStyles = (theme) => {
    return {
        container: css `
      display: flex;
    `,
        containerContent: css `
      width: 100%;
    `,
        selectors: css `
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    `,
        multiselect: css `
      width: 100%;
      margin-bottom: ${theme.spacing(1)};
    `,
        filterInput: css `
      margin-bottom: ${theme.spacing(1)};
    `,
        sort: css `
      width: 170px;
    `,
        footer: css `
      height: 60px;
      margin-top: ${theme.spacing(3)};
      display: flex;
      justify-content: center;
      font-weight: ${theme.typography.fontWeightLight};
      font-size: ${theme.typography.bodySmall.fontSize};
      a {
        font-weight: ${theme.typography.fontWeightMedium};
        margin-left: ${theme.spacing(0.25)};
      }
    `,
    };
};
export function RichHistoryStarredTab(props) {
    const { updateFilters, clearRichHistoryResults, loadMoreRichHistory, activeDatasourceInstance, richHistorySettings, queries, totalQueries, loading, richHistorySearchFilters, exploreId, } = props;
    const styles = useStyles2(getStyles);
    const listOfDatasources = createDatasourcesList();
    useEffect(() => {
        const datasourceFilters = richHistorySettings.activeDatasourceOnly && richHistorySettings.lastUsedDatasourceFilters
            ? richHistorySettings.lastUsedDatasourceFilters
            : [activeDatasourceInstance];
        const filters = {
            search: '',
            sortOrder: SortOrder.Descending,
            datasourceFilters,
            from: 0,
            to: richHistorySettings.retentionPeriod,
            starred: true,
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
    const sortOrderOptions = getSortOrderOptions();
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.containerContent },
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
                queries.map((q) => {
                    return React.createElement(RichHistoryCard, { query: q, key: q.id, exploreId: exploreId });
                }),
            queries.length && queries.length !== totalQueries ? (React.createElement("div", null,
                "Showing ",
                queries.length,
                " of ",
                totalQueries,
                " ",
                React.createElement(Button, { onClick: loadMoreRichHistory }, "Load more"))) : null,
            React.createElement("div", { className: styles.footer }, !config.queryHistoryEnabled ? 'The history is local to your browser and is not shared with others.' : ''))));
}
//# sourceMappingURL=RichHistoryStarredTab.js.map
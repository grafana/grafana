import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { of } from 'rxjs';
import { config } from '@grafana/runtime';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { getGrafanaSearcher } from 'app/features/search/service';
export function PluginUsage({ plugin }) {
    const styles = useStyles2(getStyles);
    const searchQuery = useMemo(() => {
        return {
            query: '*',
            panel_type: plugin.id,
            kind: ['panel'],
        };
    }, [plugin]);
    const results = useAsync(() => {
        return getGrafanaSearcher().search(searchQuery);
    }, [searchQuery]);
    const found = results.value;
    if (found === null || found === void 0 ? void 0 : found.totalRows) {
        return (React.createElement("div", { className: styles.wrap },
            React.createElement("div", { className: styles.info },
                plugin.name,
                " is used ",
                React.createElement("b", null, found.totalRows),
                " times."),
            React.createElement(AutoSizer, null, ({ width, height }) => {
                return (React.createElement(SearchResultsTable, { response: found, width: width, height: height, clearSelection: () => { }, keyboardEvents: of(), onTagSelected: () => { } }));
            })));
    }
    if (results.loading) {
        return React.createElement(Spinner, null);
    }
    if (!config.featureToggles.panelTitleSearch) {
        return (React.createElement(Alert, { title: "Missing feature toggle: panelTitleSearch" }, "Plugin usage requires the new search index to find usage across dashboards"));
    }
    return (React.createElement(EmptyListCTA, { title: `${plugin.name} is not used in any dashboards yet`, buttonIcon: "plus", buttonTitle: "Create Dashboard", buttonLink: `dashboard/new?panelType=${plugin.id}&editPanel=1` }));
}
export const getStyles = (theme) => {
    return {
        wrap: css `
      width: 100%;
      height: 100%;
    `,
        info: css `
      padding-bottom: 30px;
    `,
    };
};
//# sourceMappingURL=PluginUsage.js.map
import { css, cx } from '@emotion/css';
import React, { useRef } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { useDatasources, useKeyboardNavigatableList, useRecentlyUsedDataSources } from '../../hooks';
import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { DataSourceCard } from './DataSourceCard';
import { getDataSourceCompareFn, isDataSourceMatch } from './utils';
export function DataSourceList(props) {
    const containerRef = useRef(null);
    const [navigatableProps, selectedItemCssSelector] = useKeyboardNavigatableList({
        keyboardEvents: props.keyboardEvents,
        containerRef: containerRef,
    });
    const theme = useTheme2();
    const styles = getStyles(theme, selectedItemCssSelector);
    const { className, current, onChange, enableKeyboardNavigation, onClickEmptyStateCTA } = props;
    const dataSources = useDatasources({
        alerting: props.alerting,
        annotations: props.annotations,
        dashboard: props.dashboard,
        logs: props.logs,
        metrics: props.metrics,
        mixed: props.mixed,
        pluginId: props.pluginId,
        tracing: props.tracing,
        type: props.type,
        variables: props.variables,
    });
    const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
    const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;
    return (React.createElement("div", { ref: containerRef, className: cx(className, styles.container), "data-testid": "data-sources-list" },
        filteredDataSources.length === 0 && (React.createElement(EmptyState, { className: styles.emptyState, onClickCTA: onClickEmptyStateCTA })),
        filteredDataSources
            .sort(getDataSourceCompareFn(current, recentlyUsedDataSources, getDataSourceVariableIDs()))
            .map((ds) => (React.createElement(DataSourceCard, Object.assign({ "data-testid": "data-source-card", key: ds.uid, ds: ds, onClick: () => {
                pushRecentlyUsedDataSource(ds);
                onChange(ds);
            }, selected: isDataSourceMatch(ds, current) }, (enableKeyboardNavigation ? navigatableProps : {})))))));
}
function EmptyState({ className, onClickCTA }) {
    const styles = useStyles2(getEmptyStateStyles);
    return (React.createElement("div", { className: cx(className, styles.container) },
        React.createElement("p", { className: styles.message },
            React.createElement(Trans, { i18nKey: "data-source-picker.list.no-data-source-message" }, "No data sources found")),
        React.createElement(AddNewDataSourceButton, { onClick: onClickCTA })));
}
function getEmptyStateStyles(theme) {
    return {
        container: css `
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `,
        message: css `
      margin-bottom: ${theme.spacing(3)};
    `,
    };
}
function getDataSourceVariableIDs() {
    const templateSrv = getTemplateSrv();
    /** Unforunately there is no easy way to identify data sources that are variables. The uid of the data source will be the name of the variable in a templating syntax $([name]) **/
    return templateSrv
        .getVariables()
        .filter((v) => v.type === 'datasource')
        .map((v) => `\${${v.id}}`);
}
function getStyles(theme, selectedItemCssSelector) {
    return {
        container: css `
      display: flex;
      flex-direction: column;
      ${selectedItemCssSelector} {
        background-color: ${theme.colors.background.secondary};
      }
    `,
        emptyState: css `
      height: 100%;
      flex: 1;
    `,
    };
}
//# sourceMappingURL=DataSourceList.js.map
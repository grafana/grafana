import { css } from '@emotion/css';
import React from 'react';
import { hasSupplementaryQuerySupport, LoadingState, LogsDedupStrategy, SupplementaryQueryType, } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';
import { LogRows } from '../../logs/components/LogRows';
import { dataFrameToLogsModel } from '../../logs/logsModel';
import { SupplementaryResultError } from '../SupplementaryResultError';
import { SETTINGS_KEYS } from './utils/logs';
export function LogsSamplePanel(props) {
    const { queryResponse, timeZone, enabled, setLogsSampleEnabled, datasourceInstance, queries, splitOpen } = props;
    const styles = useStyles2(getStyles);
    const onToggleLogsSampleCollapse = (isOpen) => {
        var _a;
        setLogsSampleEnabled(isOpen);
        reportInteraction('grafana_explore_logs_sample_toggle_clicked', {
            datasourceType: (_a = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.type) !== null && _a !== void 0 ? _a : 'unknown',
            type: isOpen ? 'open' : 'close',
        });
    };
    const OpenInSplitViewButton = () => {
        if (!hasSupplementaryQuerySupport(datasourceInstance, SupplementaryQueryType.LogsSample)) {
            return null;
        }
        const logSampleQueries = queries
            .map((query) => datasourceInstance.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample }, query))
            .filter((query) => !!query);
        if (!logSampleQueries.length) {
            return null;
        }
        const onSplitOpen = () => {
            var _a;
            splitOpen({ queries: logSampleQueries, datasourceUid: datasourceInstance.uid });
            reportInteraction('grafana_explore_logs_sample_split_button_clicked', {
                datasourceType: (_a = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.type) !== null && _a !== void 0 ? _a : 'unknown',
                queriesCount: logSampleQueries.length,
            });
        };
        return (React.createElement(Button, { size: "sm", className: styles.logSamplesButton, onClick: onSplitOpen }, "Open logs in split view"));
    };
    let LogsSamplePanelContent;
    if (queryResponse === undefined) {
        LogsSamplePanelContent = null;
    }
    else if (queryResponse.error !== undefined) {
        LogsSamplePanelContent = (React.createElement(SupplementaryResultError, { error: queryResponse.error, title: "Failed to load logs sample for this query" }));
    }
    else if (queryResponse.state === LoadingState.Loading) {
        LogsSamplePanelContent = React.createElement("span", null, "Logs sample is loading...");
    }
    else if (queryResponse.data.length === 0 || queryResponse.data.every((frame) => frame.length === 0)) {
        LogsSamplePanelContent = React.createElement("span", null, "No logs sample data.");
    }
    else {
        const logs = dataFrameToLogsModel(queryResponse.data);
        LogsSamplePanelContent = (React.createElement(React.Fragment, null,
            React.createElement(OpenInSplitViewButton, null),
            React.createElement("div", { className: styles.logContainer },
                React.createElement(LogRows, { logRows: logs.rows, dedupStrategy: LogsDedupStrategy.none, showLabels: store.getBool(SETTINGS_KEYS.showLabels, false), showTime: store.getBool(SETTINGS_KEYS.showTime, true), wrapLogMessage: store.getBool(SETTINGS_KEYS.wrapLogMessage, true), prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false), timeZone: timeZone, enableLogDetails: true }))));
    }
    return (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.state) !== LoadingState.NotStarted ? (React.createElement(Collapse, { className: styles.logsSamplePanel, label: React.createElement("div", null,
            "Logs sample",
            React.createElement(Tooltip, { content: "Show log lines that contributed to visualized metrics" },
                React.createElement(Icon, { name: "info-circle", className: styles.infoTooltip }))), isOpen: enabled, collapsible: true, onToggle: onToggleLogsSampleCollapse }, LogsSamplePanelContent)) : null;
}
const getStyles = (theme) => {
    const scrollableLogsContainer = config.featureToggles.exploreScrollableLogsContainer;
    return {
        logsSamplePanel: css `
      ${scrollableLogsContainer && 'max-height: calc(100vh - 115px);'}
    `,
        logSamplesButton: css `
      position: absolute;
      top: ${theme.spacing(1)};
      right: ${theme.spacing(1)};
    `,
        logContainer: css `
      ${scrollableLogsContainer && 'position: relative;'}
      ${scrollableLogsContainer && 'height: 100%;'}
      overflow: scroll;
    `,
        infoTooltip: css `
      margin-left: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=LogsSamplePanel.js.map
import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { LogsSortOrder, DataHoverClearEvent, DataHoverEvent, CoreApp, } from '@grafana/data';
import { CustomScrollbar, useStyles2, usePanelContext } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';
import { LogLabels } from '../../../features/logs/components/LogLabels';
import { LogRows } from '../../../features/logs/components/LogRows';
import { dataFrameToLogsModel, dedupLogRows, COMMON_LABELS } from '../../../features/logs/logsModel';
export const LogsPanel = ({ data, timeZone, fieldConfig, options: { showLabels, showTime, wrapLogMessage, showCommonLabels, prettifyLogMessage, sortOrder, dedupStrategy, enableLogDetails, }, title, id, }) => {
    const isAscending = sortOrder === LogsSortOrder.Ascending;
    const style = useStyles2(getStyles);
    const [scrollTop, setScrollTop] = useState(0);
    const logsContainerRef = useRef(null);
    const { eventBus } = usePanelContext();
    const onLogRowHover = useCallback((row) => {
        if (!row) {
            eventBus.publish(new DataHoverClearEvent());
        }
        else {
            eventBus.publish(new DataHoverEvent({
                point: {
                    time: row.timeEpochMs,
                },
            }));
        }
    }, [eventBus]);
    // Important to memoize stuff here, as panel rerenders a lot for example when resizing.
    const [logRows, deduplicatedRows, commonLabels] = useMemo(() => {
        var _a, _b, _c;
        const logs = data
            ? dataFrameToLogsModel(data.series, (_a = data.request) === null || _a === void 0 ? void 0 : _a.intervalMs, undefined, (_b = data.request) === null || _b === void 0 ? void 0 : _b.targets)
            : null;
        const logRows = (logs === null || logs === void 0 ? void 0 : logs.rows) || [];
        const commonLabels = (_c = logs === null || logs === void 0 ? void 0 : logs.meta) === null || _c === void 0 ? void 0 : _c.find((m) => m.label === COMMON_LABELS);
        const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
        return [logRows, deduplicatedRows, commonLabels];
    }, [data, dedupStrategy]);
    useLayoutEffect(() => {
        if (isAscending && logsContainerRef.current) {
            setScrollTop(logsContainerRef.current.offsetHeight);
        }
        else {
            setScrollTop(0);
        }
    }, [isAscending, logRows]);
    const getFieldLinks = useCallback((field, rowIndex) => {
        return getFieldLinksForExplore({ field, rowIndex, range: data.timeRange });
    }, [data]);
    if (!data || logRows.length === 0) {
        return React.createElement(PanelDataErrorView, { fieldConfig: fieldConfig, panelId: id, data: data, needsStringField: true });
    }
    const renderCommonLabels = () => (React.createElement("div", { className: cx(style.labelContainer, isAscending && style.labelContainerAscending) },
        React.createElement("span", { className: style.label }, "Common labels:"),
        React.createElement(LogLabels, { labels: commonLabels ? commonLabels.value : { labels: '(no common labels)' } })));
    return (React.createElement(CustomScrollbar, { autoHide: true, scrollTop: scrollTop },
        React.createElement("div", { className: style.container, ref: logsContainerRef },
            showCommonLabels && !isAscending && renderCommonLabels(),
            React.createElement(LogRows, { logRows: logRows, deduplicatedRows: deduplicatedRows, dedupStrategy: dedupStrategy, showLabels: showLabels, showTime: showTime, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, getFieldLinks: getFieldLinks, logsSortOrder: sortOrder, enableLogDetails: enableLogDetails, previewLimit: isAscending ? logRows.length : undefined, onLogRowHover: onLogRowHover, app: CoreApp.Dashboard }),
            showCommonLabels && isAscending && renderCommonLabels())));
};
const getStyles = (theme) => ({
    container: css({
        marginBottom: theme.spacing(1.5),
    }),
    labelContainer: css({
        margin: theme.spacing(0, 0, 0.5, 0.5),
        display: 'flex',
        alignItems: 'center',
    }),
    labelContainerAscending: css({
        margin: theme.spacing(0.5, 0, 0.5, 0),
    }),
    label: css({
        marginRight: theme.spacing(0.5),
        fontSize: theme.typography.bodySmall.fontSize,
        fontWeight: theme.typography.fontWeightMedium,
    }),
});
//# sourceMappingURL=LogsPanel.js.map
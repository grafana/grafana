import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { css } from '@emotion/css';
import { LogRows, CustomScrollbar, LogLabels, useStyles2, usePanelContext } from '@grafana/ui';
import { LogsSortOrder, DataHoverClearEvent, DataHoverEvent, } from '@grafana/data';
import { dataFrameToLogsModel, dedupLogRows } from 'app/core/logs_model';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { COMMON_LABELS } from '../../../core/logs_model';
export var LogsPanel = function (_a) {
    var data = _a.data, timeZone = _a.timeZone, _b = _a.options, showLabels = _b.showLabels, showTime = _b.showTime, wrapLogMessage = _b.wrapLogMessage, showCommonLabels = _b.showCommonLabels, prettifyLogMessage = _b.prettifyLogMessage, sortOrder = _b.sortOrder, dedupStrategy = _b.dedupStrategy, enableLogDetails = _b.enableLogDetails, title = _a.title;
    var isAscending = sortOrder === LogsSortOrder.Ascending;
    var style = useStyles2(getStyles(title, isAscending));
    var _c = __read(useState(0), 2), scrollTop = _c[0], setScrollTop = _c[1];
    var logsContainerRef = useRef(null);
    var eventBus = usePanelContext().eventBus;
    var onLogRowHover = useCallback(function (row) {
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
    var _d = __read(useMemo(function () {
        var _a, _b;
        var newResults = data ? dataFrameToLogsModel(data.series, (_a = data.request) === null || _a === void 0 ? void 0 : _a.intervalMs) : null;
        var logRows = (newResults === null || newResults === void 0 ? void 0 : newResults.rows) || [];
        var commonLabels = (_b = newResults === null || newResults === void 0 ? void 0 : newResults.meta) === null || _b === void 0 ? void 0 : _b.find(function (m) { return m.label === COMMON_LABELS; });
        var deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
        return [logRows, deduplicatedRows, commonLabels];
    }, [data, dedupStrategy]), 3), logRows = _d[0], deduplicatedRows = _d[1], commonLabels = _d[2];
    useLayoutEffect(function () {
        if (isAscending && logsContainerRef.current) {
            setScrollTop(logsContainerRef.current.offsetHeight);
        }
        else {
            setScrollTop(0);
        }
    }, [isAscending, logRows]);
    var getFieldLinks = useCallback(function (field, rowIndex) {
        return getFieldLinksForExplore({ field: field, rowIndex: rowIndex, range: data.timeRange });
    }, [data]);
    if (!data) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No data found in response")));
    }
    var renderCommonLabels = function () { return (React.createElement("div", { className: style.labelContainer },
        React.createElement("span", { className: style.label }, "Common labels:"),
        React.createElement(LogLabels, { labels: commonLabels ? commonLabels.value : { labels: '(no common labels)' } }))); };
    return (React.createElement(CustomScrollbar, { autoHide: true, scrollTop: scrollTop },
        React.createElement("div", { className: style.container, ref: logsContainerRef },
            showCommonLabels && !isAscending && renderCommonLabels(),
            React.createElement(LogRows, { logRows: logRows, deduplicatedRows: deduplicatedRows, dedupStrategy: dedupStrategy, showLabels: showLabels, showTime: showTime, wrapLogMessage: wrapLogMessage, prettifyLogMessage: prettifyLogMessage, timeZone: timeZone, getFieldLinks: getFieldLinks, logsSortOrder: sortOrder, enableLogDetails: enableLogDetails, previewLimit: isAscending ? logRows.length : undefined, onLogRowHover: onLogRowHover }),
            showCommonLabels && isAscending && renderCommonLabels())));
};
var getStyles = function (title, isAscending) { return function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    //We can remove this hot-fix when we fix panel menu with no title overflowing top of all panels\n    margin-top: ", ";\n  "], ["\n    margin-bottom: ", ";\n    //We can remove this hot-fix when we fix panel menu with no title overflowing top of all panels\n    margin-top: ", ";\n  "])), theme.spacing(1.5), theme.spacing(!title ? 2.5 : 0)),
    labelContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin: ", ";\n    display: flex;\n    align-items: center;\n  "], ["\n    margin: ", ";\n    display: flex;\n    align-items: center;\n  "])), isAscending ? theme.spacing(0.5, 0, 0.5, 0) : theme.spacing(0, 0, 0.5, 0.5)),
    label: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-right: ", ";\n    font-size: ", ";\n    font-weight: ", ";\n  "], ["\n    margin-right: ", ";\n    font-size: ", ";\n    font-weight: ", ";\n  "])), theme.spacing(0.5), theme.typography.bodySmall.fontSize, theme.typography.fontWeightMedium),
}); }; };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LogsPanel.js.map
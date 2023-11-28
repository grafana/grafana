import { css } from '@emotion/css';
import { flatten, groupBy, mapValues, sortBy } from 'lodash';
import React, { useMemo } from 'react';
import { LoadingState, } from '@grafana/data';
import { Button, InlineField, Alert, useStyles2 } from '@grafana/ui';
import { mergeLogsVolumeDataFrames, isLogsVolumeLimited, getLogsVolumeMaximumRange } from '../../logs/utils';
import { SupplementaryResultError } from '../SupplementaryResultError';
import { LogsVolumePanel } from './LogsVolumePanel';
import { isTimeoutErrorResponse } from './utils/logsVolumeResponse';
export const LogsVolumePanelList = ({ logsVolumeData, absoluteRange, onUpdateTimeRange, width, onLoadLogsVolume, onHiddenSeriesChanged, eventBus, splitOpen, timeZone, onClose, }) => {
    const { logVolumes, maximumValue: allLogsVolumeMaximumValue, maximumRange: allLogsVolumeMaximumRange, } = useMemo(() => {
        let maximumValue = -Infinity;
        const sorted = sortBy((logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.data) || [], 'meta.custom.datasourceName');
        const grouped = groupBy(sorted, 'meta.custom.datasourceName');
        const logVolumes = mapValues(grouped, (value) => {
            const mergedData = mergeLogsVolumeDataFrames(value);
            maximumValue = Math.max(maximumValue, mergedData.maximum);
            return mergedData.dataFrames;
        });
        const maximumRange = getLogsVolumeMaximumRange(flatten(Object.values(logVolumes)));
        return {
            maximumValue,
            maximumRange,
            logVolumes,
        };
    }, [logsVolumeData]);
    const styles = useStyles2(getStyles);
    const numberOfLogVolumes = Object.keys(logVolumes).length;
    const containsZoomed = Object.values(logVolumes).some((data) => {
        const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
        return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
    });
    const timeoutError = isTimeoutErrorResponse(logsVolumeData);
    const visibleRange = {
        from: Math.max(absoluteRange.from, allLogsVolumeMaximumRange.from),
        to: Math.min(absoluteRange.to, allLogsVolumeMaximumRange.to),
    };
    if ((logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.state) === LoadingState.Loading) {
        return React.createElement("span", null, "Loading...");
    }
    else if (timeoutError) {
        return (React.createElement(SupplementaryResultError, { title: "The logs volume query has timed out", 
            // Using info to avoid users thinking that the actual query has failed.
            severity: "info", suggestedAction: "Retry", onSuggestedAction: onLoadLogsVolume, onRemove: onClose }));
    }
    else if ((logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.error) !== undefined) {
        return React.createElement(SupplementaryResultError, { error: logsVolumeData.error, title: "Failed to load log volume for this query" });
    }
    if (numberOfLogVolumes === 0) {
        return (React.createElement("div", { className: styles.alertContainer },
            React.createElement(Alert, { severity: "info", title: "No logs volume available" }, "No volume information available for the current queries and time range.")));
    }
    return (React.createElement("div", { className: styles.listContainer },
        Object.keys(logVolumes).map((name, index) => {
            const logsVolumeData = { data: logVolumes[name] };
            return (React.createElement(LogsVolumePanel, { key: index, absoluteRange: visibleRange, allLogsVolumeMaximum: allLogsVolumeMaximumValue, width: width, logsVolumeData: logsVolumeData, onUpdateTimeRange: onUpdateTimeRange, timeZone: timeZone, splitOpen: splitOpen, onLoadLogsVolume: onLoadLogsVolume, 
                // TODO: Support filtering level from multiple log levels
                onHiddenSeriesChanged: numberOfLogVolumes > 1 ? () => { } : onHiddenSeriesChanged, eventBus: eventBus }));
        }),
        containsZoomed && (React.createElement("div", { className: styles.extraInfoContainer },
            React.createElement(InlineField, { label: "Reload log volume", transparent: true },
                React.createElement(Button, { size: "xs", icon: "sync", variant: "secondary", onClick: onLoadLogsVolume, id: "reload-volume" }))))));
};
const getStyles = (theme) => {
    return {
        listContainer: css `
      padding-top: 10px;
    `,
        extraInfoContainer: css `
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: 5px;
    `,
        oldInfoText: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
        alertContainer: css `
      width: 50%;
      min-width: ${theme.breakpoints.values.sm}px;
      margin: 0 auto;
    `,
    };
};
function logsLevelZoomRatio(logsVolumeData, selectedTimeRange) {
    var _a, _b;
    const dataRange = logsVolumeData && logsVolumeData[0] && ((_b = (_a = logsVolumeData[0].meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.absoluteRange);
    return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}
//# sourceMappingURL=LogsVolumePanelList.js.map
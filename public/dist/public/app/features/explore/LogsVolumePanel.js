import { __makeTemplateObject } from "tslib";
import { LoadingState } from '@grafana/data';
import { Alert, Button, Collapse, TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';
import { ExploreGraph } from './ExploreGraph';
import React from 'react';
import { css } from '@emotion/css';
export function LogsVolumePanel(props) {
    var _a;
    var width = props.width, logsVolumeData = props.logsVolumeData, absoluteRange = props.absoluteRange, timeZone = props.timeZone, splitOpen = props.splitOpen, onUpdateTimeRange = props.onUpdateTimeRange, onLoadLogsVolume = props.onLoadLogsVolume;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
    var height = 150;
    var LogsVolumePanelContent;
    if (!logsVolumeData) {
        return null;
    }
    else if (logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.error) {
        return (React.createElement(Alert, { title: "Failed to load volume logs for this query" }, ((_a = logsVolumeData.error.data) === null || _a === void 0 ? void 0 : _a.message) || logsVolumeData.error.statusText || logsVolumeData.error.message));
    }
    else if ((logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.state) === LoadingState.Loading) {
        LogsVolumePanelContent = React.createElement("span", null, "Logs volume is loading...");
    }
    else if (logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.data) {
        if (logsVolumeData.data.length > 0) {
            LogsVolumePanelContent = (React.createElement(ExploreGraph, { graphStyle: "lines", loadingState: LoadingState.Done, data: logsVolumeData.data, height: height, width: width - spacing, absoluteRange: absoluteRange, onChangeTime: onUpdateTimeRange, timeZone: timeZone, splitOpenFn: splitOpen, tooltipDisplayMode: TooltipDisplayMode.Multi }));
        }
        else {
            LogsVolumePanelContent = React.createElement("span", null, "No volume data.");
        }
    }
    var zoomRatio = logsLevelZoomRatio(logsVolumeData, absoluteRange);
    var zoomLevelInfo;
    if (zoomRatio !== undefined && zoomRatio < 1) {
        zoomLevelInfo = (React.createElement(React.Fragment, null,
            React.createElement("span", { className: styles.zoomInfo }, "Reload logs volume"),
            React.createElement(Button, { size: "xs", icon: "sync", variant: "secondary", onClick: onLoadLogsVolume })));
    }
    return (React.createElement(Collapse, { label: "Logs volume", isOpen: true, loading: (logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.state) === LoadingState.Loading },
        React.createElement("div", { style: { height: height }, className: styles.contentContainer }, LogsVolumePanelContent),
        React.createElement("div", { className: styles.zoomInfoContainer }, zoomLevelInfo)));
}
var getStyles = function (theme) {
    return {
        zoomInfoContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      justify-content: end;\n      position: absolute;\n      right: 5px;\n      top: 5px;\n    "], ["\n      display: flex;\n      justify-content: end;\n      position: absolute;\n      right: 5px;\n      top: 5px;\n    "]))),
        zoomInfo: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: 8px;\n      font-size: ", ";\n    "], ["\n      padding: 8px;\n      font-size: ", ";\n    "])), theme.typography.bodySmall.fontSize),
        contentContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "]))),
    };
};
function logsLevelZoomRatio(logsVolumeData, selectedTimeRange) {
    var _a, _b;
    var dataRange = logsVolumeData && logsVolumeData.data[0] && ((_b = (_a = logsVolumeData.data[0].meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.absoluteRange);
    return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LogsVolumePanel.js.map
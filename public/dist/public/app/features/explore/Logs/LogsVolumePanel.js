import { css } from '@emotion/css';
import { identity } from 'lodash';
import React from 'react';
import { LoadingState, } from '@grafana/data';
import { Icon, Tooltip, TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';
import { getLogsVolumeDataSourceInfo, isLogsVolumeLimited } from '../../logs/utils';
import { ExploreGraph } from '../Graph/ExploreGraph';
export function LogsVolumePanel(props) {
    var _a;
    const { width, timeZone, splitOpen, onUpdateTimeRange, onHiddenSeriesChanged, allLogsVolumeMaximum } = props;
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
    const height = 150;
    const logsVolumeData = props.logsVolumeData;
    const logsVolumeInfo = getLogsVolumeDataSourceInfo(logsVolumeData === null || logsVolumeData === void 0 ? void 0 : logsVolumeData.data);
    let extraInfo = logsVolumeInfo ? `${logsVolumeInfo.name}` : '';
    if (isLogsVolumeLimited(logsVolumeData.data)) {
        extraInfo = [
            extraInfo,
            'This datasource does not support full-range histograms. The graph below is based on the logs seen in the response.',
        ]
            .filter(identity)
            .join('. ');
    }
    let extraInfoComponent = React.createElement("span", null, extraInfo);
    if (logsVolumeData.state === LoadingState.Streaming) {
        extraInfoComponent = (React.createElement(React.Fragment, null,
            extraInfoComponent,
            React.createElement(Tooltip, { content: "Streaming" },
                React.createElement(Icon, { name: "circle-mono", size: "md", className: styles.streaming, "data-testid": "logs-volume-streaming" }))));
    }
    return (React.createElement("div", { style: { height }, className: styles.contentContainer },
        React.createElement(ExploreGraph, { graphStyle: "lines", loadingState: (_a = logsVolumeData.state) !== null && _a !== void 0 ? _a : LoadingState.Done, data: logsVolumeData.data, height: height, width: width - spacing * 2, absoluteRange: props.absoluteRange, onChangeTime: onUpdateTimeRange, timeZone: timeZone, splitOpenFn: splitOpen, tooltipDisplayMode: TooltipDisplayMode.Multi, onHiddenSeriesChanged: onHiddenSeriesChanged, anchorToZero: true, yAxisMaximum: allLogsVolumeMaximum, eventBus: props.eventBus }),
        extraInfoComponent && React.createElement("div", { className: styles.extraInfoContainer }, extraInfoComponent)));
}
const getStyles = (theme) => {
    return {
        extraInfoContainer: css `
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: -10px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
        contentContainer: css `
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    `,
        streaming: css `
      color: ${theme.colors.success.text};
    `,
    };
};
//# sourceMappingURL=LogsVolumePanel.js.map
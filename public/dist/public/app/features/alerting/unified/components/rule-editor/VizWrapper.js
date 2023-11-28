import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { isTimeSeriesFrames } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { GraphContainer } from 'app/features/explore/Graph/GraphContainer';
import { ExpressionResult } from '../expressions/Expression';
import { getStatusMessage } from './util';
/** The VizWrapper is just a simple component that renders either a table or a graph based on the type of data we receive from "PanelData" */
export const VizWrapper = ({ data, thresholds, thresholdsType }) => {
    const styles = useStyles2(getStyles);
    const isTimeSeriesData = isTimeSeriesFrames(data.series);
    const statusMessage = getStatusMessage(data);
    const thresholdsStyle = thresholdsType ? { mode: thresholdsType } : undefined;
    const timeRange = {
        from: data.timeRange.from.valueOf(),
        to: data.timeRange.to.valueOf(),
    };
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => (React.createElement("div", { style: { width } }, isTimeSeriesData ? (React.createElement(GraphContainer, { statusMessage: statusMessage, data: data.series, eventBus: appEvents, height: 300, width: width, absoluteRange: timeRange, timeZone: "browser", onChangeTime: () => { }, splitOpenFn: () => { }, loadingState: data.state, thresholdsConfig: thresholds, thresholdsStyle: thresholdsStyle })) : (React.createElement("div", { className: styles.instantVectorResultWrapper },
            React.createElement("header", { className: styles.title }, "Table"),
            React.createElement(ExpressionResult, { series: data.series }))))))));
};
const getStyles = (theme) => ({
    wrapper: css `
    width: 100%;
    position: relative;
  `,
    instantVectorResultWrapper: css `
    border: solid 1px ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    padding: 0;

    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
  `,
    title: css({
        label: 'panel-title',
        padding: theme.spacing(),
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontSize: theme.typography.h6.fontSize,
        fontWeight: theme.typography.h6.fontWeight,
    }),
});
//# sourceMappingURL=VizWrapper.js.map
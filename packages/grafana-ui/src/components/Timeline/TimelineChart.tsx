import React from 'react';
import { withTheme } from '../../themes';
import { DataFrame } from '@grafana/data';
import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { preparePlotConfigBuilder } from './utils';
import { TimelineProps } from './types';

const shouldReconfig = (prevProps: TimelineProps, props?: TimelineProps) => {
  const { mode, rowHeight, colWidth, showValue } = props;

  return (
    mode !== prevProps.mode ||
    rowHeight !== prevProps.rowHeight ||
    colWidth !== prevProps.colWidth ||
    showValue !== prevProps.showValue
  );
};

const addlProps = (props: TimelineProps) => {
  const { mode, rowHeight, colWidth, showValue } = props;

  return {
    mode,
    rowHeight,
    colWidth,
    showValue,
  };
};

const renderLegend = (props: TimelineProps, config: UPlotConfigBuilder, alignedDataFrame: DataFrame) => {
  return undefined;
};

export class UnthemedTimelineChart extends React.Component<TimelineProps> {
  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={preparePlotConfigBuilder}
        shouldReconfig={shouldReconfig}
        addlProps={addlProps}
        renderLegend={renderLegend}
      />
    );
  }
}

export const TimelineChart = withTheme(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';

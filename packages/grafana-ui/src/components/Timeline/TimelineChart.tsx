import React from 'react';
import { withTheme2 } from '../../themes/ThemeContext';
import { DataFrame, TimeRange } from '@grafana/data';
import { GraphNG } from '../GraphNG/GraphNG';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { preparePlotConfigBuilder } from './utils';
import { TimelineProps } from './types';

const propsToDiff = ['mode', 'rowHeight', 'colWidth', 'showValue'];

export class UnthemedTimelineChart extends React.Component<TimelineProps> {
  prepConfig = (alignedFrame: DataFrame, getTimeRange: () => TimeRange) => {
    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      ...this.props,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    return undefined;
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend}
      />
    );
  }
}

export const TimelineChart = withTheme2(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';

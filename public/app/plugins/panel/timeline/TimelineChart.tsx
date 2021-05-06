import React from 'react';
import { withTheme2, UPlotConfigBuilder, GraphNG, GraphNGProps } from '@grafana/ui';
import { DataFrame, TimeRange } from '@grafana/data';
import { preparePlotConfigBuilder } from './utils';
import { BarValueVisibility, TimelineMode } from './types';

/**
 * @alpha
 */
export interface TimelineProps extends Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {
  mode: TimelineMode;
  rowHeight: number;
  showValue: BarValueVisibility;
  colWidth?: number;
}

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
    return;
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend as any}
      />
    );
  }
}

export const TimelineChart = withTheme2(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';

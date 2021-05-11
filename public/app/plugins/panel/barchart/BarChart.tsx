import React from 'react';
import { DataFrame, TimeRange } from '@grafana/data';
import { GraphNG, GraphNGProps, LegendDisplayMode, PlotLegend, UPlotConfigBuilder, withTheme2 } from '@grafana/ui';
import { BarChartOptions } from './types';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';

/**
 * @alpha
 */
export interface BarChartProps
  extends BarChartOptions,
    Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {}

const propsToDiff: string[] = ['orientation', 'barWidth', 'groupWidth', 'showValue'];

class UnthemedBarChart extends React.Component<BarChartProps> {
  prepConfig = (alignedFrame: DataFrame, getTimeRange: () => TimeRange) => {
    const { eventBus } = this.context;
    const { theme, timeZone, orientation, barWidth, showValue, groupWidth, stacking, legend, tooltip } = this.props;
    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      theme,
      timeZone,
      eventBus,
      orientation,
      barWidth,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, onLegendClick, frames } = this.props;

    if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
      return;
    }

    return (
      <PlotLegend
        data={frames}
        config={config}
        onLegendClick={onLegendClick}
        maxHeight="35%"
        maxWidth="60%"
        {...legend}
      />
    );
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        frames={this.props.frames}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        preparePlotFrame={preparePlotFrame}
        renderLegend={this.renderLegend as any}
      />
    );
  }
}

export const BarChart = withTheme2(UnthemedBarChart);
BarChart.displayName = 'BarChart';

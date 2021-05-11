import React from 'react';
import { DataFrame, TimeRange } from '@grafana/data';
import { BarChartOptions } from './types';
import { withTheme2 } from '../../themes/ThemeContext';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { LegendDisplayMode } from '../VizLegend/models.gen';
import { PlotLegend } from '../uPlot/PlotLegend';
import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';

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

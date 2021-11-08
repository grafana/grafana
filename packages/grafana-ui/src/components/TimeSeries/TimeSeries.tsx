import React from 'react';
import { DataFrame, TimeRange } from '@grafana/data';
import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { PlotLegend } from '../uPlot/PlotLegend';
import { LegendDisplayMode } from '@grafana/schema';
import { preparePlotConfigBuilder } from './utils';
import { withTheme2 } from '../../themes/ThemeContext';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { PropDiffFn } from '../../../../../packages/grafana-ui/src/components/GraphNG/GraphNG';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends React.Component<TimeSeriesProps> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;

  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const { eventBus, sync } = this.context;
    const { theme, timeZone, legend, renderers, tweakAxis, tweakScale } = this.props;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      theme,
      timeZone,
      getTimeRange,
      eventBus,
      sync,
      allFrames,
      legend,
      renderers,
      tweakScale,
      tweakAxis,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    return <PlotLegend data={frames} config={config} {...legend} />;
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

export const TimeSeries = withTheme2(UnthemedTimeSeries);
TimeSeries.displayName = 'TimeSeries';

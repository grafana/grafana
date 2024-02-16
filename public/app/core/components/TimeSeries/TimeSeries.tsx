import React, { Component } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';
import { PanelContextRoot } from '@grafana/ui/src/components/PanelChrome/PanelContext';
import { hasVisibleLegendSeries, PlotLegend } from '@grafana/ui/src/components/uPlot/PlotLegend';
import { UPlotConfigBuilder } from '@grafana/ui/src/components/uPlot/config/UPlotConfigBuilder';
import { withTheme2 } from '@grafana/ui/src/themes/ThemeContext';

import { GraphNG, GraphNGProps, PropDiffFn } from '../GraphNG/GraphNG';

import { preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends Component<TimeSeriesProps> {
  static contextType = PanelContextRoot;
  declare context: React.ContextType<typeof PanelContextRoot>;

  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const { eventBus, eventsScope, sync } = this.context;
    const { theme, timeZone, options, renderers, tweakAxis, tweakScale } = this.props;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      theme,
      timeZones: Array.isArray(timeZone) ? timeZone : [timeZone],
      getTimeRange,
      eventBus,
      sync,
      allFrames,
      renderers,
      tweakScale,
      tweakAxis,
      eventsScope,
      hoverProximity: options?.tooltip?.hoverProximity,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    if (!config || (legend && !legend.showLegend) || !hasVisibleLegendSeries(config, frames)) {
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
        renderLegend={this.renderLegend}
      />
    );
  }
}

export const TimeSeries = withTheme2(UnthemedTimeSeries);
TimeSeries.displayName = 'TimeSeries';

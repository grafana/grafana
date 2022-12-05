import React, { Component } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';

import { withTheme2 } from '../../themes/ThemeContext';
import { GraphNG, GraphNGProps, PropDiffFn } from '../GraphNG/GraphNG';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';

import { preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends Component<TimeSeriesProps> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;

  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const { eventBus, sync } = this.context as PanelContext;
    const { theme, timeZone, renderers, tweakAxis, tweakScale } = this.props;

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
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    //hides and shows the legend ON the uPlot graph
    if (!config || (legend && !legend.showLegend)) {
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

import { Component } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';
import { VizLegend2 } from '@grafana/ui';
import { hasVisibleLegendSeries, PlotLegend } from '@grafana/ui/src/components/uPlot/PlotLegend';
import { UPlotConfigBuilder } from '@grafana/ui/src/components/uPlot/config/UPlotConfigBuilder';
import { withTheme2 } from '@grafana/ui/src/themes/ThemeContext';
import { config } from 'app/core/config';

import { GraphNG, GraphNGProps, PropDiffFn } from '../GraphNG/GraphNG';

import { preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends Component<TimeSeriesProps> {
  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const { theme, timeZone, options, renderers, tweakAxis, tweakScale } = this.props;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      theme,
      timeZones: Array.isArray(timeZone) ? timeZone : [timeZone],
      getTimeRange,
      allFrames,
      renderers,
      tweakScale,
      tweakAxis,
      hoverProximity: options?.tooltip?.hoverProximity,
      orientation: options?.orientation,
    });
  };

  // JEV: REFACTOR: create a renderLegend/buildLegend function across all components?
  renderLegend = (uPlotConfig: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;
    // console.log(!config, '!config');
    // console.log(legend, 'legend');
    // console.log(!legend.showLegend, '!legend.showLegend');
    // console.log(!hasVisibleLegendSeries(config, frames), '!hasVisibleLegendSeries(config, frames)');
    // JEV: REFACTOR: send this short circuit to the legend component? or cut off early in a shared function?
    // JEV: OBSERVATION: `hasVisibleLegendSeries` short circuits candlestick
    if (!uPlotConfig || (legend && !legend.showLegend) || !hasVisibleLegendSeries(uPlotConfig, frames)) {
      return null;
    }

    if (config.featureToggles.newVizLegend) {
      return <VizLegend2 data={frames} {...legend} />;
    } else {
      // JEV: REFACTOR: remove plotlegend in favor of new legend component/interface?
      return <PlotLegend data={frames} config={uPlotConfig} {...legend} />;
    }
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

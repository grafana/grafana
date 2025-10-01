import { Component } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR, withTheme2 } from '@grafana/ui';
import { hasVisibleLegendSeries, PlotLegend, UPlotConfigBuilder, UPlotSeriesBuilder } from '@grafana/ui/internal';

import { GraphNG, GraphNGProps, PropDiffFn } from '../GraphNG/GraphNG';

import { calculateAnnotationLaneSizes, preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends Component<TimeSeriesProps> {
  prepConfig = (
    alignedFrame: DataFrame,
    allFrames: DataFrame[],
    getTimeRange: () => TimeRange,
    annotations?: DataFrame[]
  ) => {
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
      xAxisConfig: {
        ...calculateAnnotationLaneSizes(annotations?.length ?? 0, options?.annotations),
      },
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames, annotations, theme } = this.props;

    if (!config || (legend && !legend.showLegend) || !hasVisibleLegendSeries(config, frames)) {
      return null;
    }

    let uPlotSeriesAnnos: UPlotSeriesBuilder[] | undefined = [];

    if (annotations !== undefined && annotations.length > 0) {
      annotations.forEach((anno) => {
        //TODO : What should we do if there are multiple colors?
        const colorField = anno.fields.find((f) => f.name === 'color');
        const series = {
          label: anno.name,
          scaleKey: config.scaleKeys[0],
          theme: theme,
          show: anno.fields.some((f) => {
            return (f.config.custom.hideFrom?.viz ?? false) === false;
          }),
          lineColor: colorField?.values[0] ?? DEFAULT_ANNOTATION_COLOR,
        };
        uPlotSeriesAnnos.push(new UPlotSeriesBuilder(series));
      });
    }

    return <PlotLegend data={frames} config={config} annotations={uPlotSeriesAnnos} {...legend} />;
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

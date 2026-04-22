import { useCallback } from 'react';

import { type DataFrame, type TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { hasVisibleLegendSeries, PlotLegend, type UPlotConfigBuilder } from '@grafana/ui/internal';
import { type TimeSeriesLegendOptions } from 'app/plugins/panel/timeseries/panelcfg.gen';

import { GraphNG, type GraphNGProps, type PropDiffFn } from '../GraphNG/GraphNG';

import { getXAxisConfig, preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'annotationLanes', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend' | 'theme' | 'legend'> & {
  legend: TimeSeriesLegendOptions;
};

export function TimeSeries(props: TimeSeriesProps) {
  const { timeZone, options, renderers, tweakAxis, tweakScale, legend, frames } = props;
  const theme = useTheme2();

  const prepConfig = useCallback(
    (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange, annotationLanes?: number) => {
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
        xAxisConfig: getXAxisConfig(annotationLanes),
      });
    },
    [theme, timeZone, options, renderers, tweakAxis, tweakScale]
  );

  const renderLegend = useCallback(
    (uPlotConfig: UPlotConfigBuilder) => {
      if (!uPlotConfig || (legend && !legend.showLegend) || !hasVisibleLegendSeries(uPlotConfig, frames)) {
        return null;
      }

      const enableFacetedFilter = config.featureToggles.vizLegendFacetedFilter && legend?.enableFacetedFilter;
      return <PlotLegend data={frames} config={uPlotConfig} {...legend} enableFacetedFilter={enableFacetedFilter} />;
    },
    [legend, frames]
  );

  return (
    <GraphNG {...props} theme={theme} prepConfig={prepConfig} propsToDiff={propsToDiff} renderLegend={renderLegend} />
  );
}

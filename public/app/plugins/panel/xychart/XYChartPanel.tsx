import React, { /*useCallback,*/ useContext, useMemo } from 'react';
import { /*Button, GraphNGLegendEvent,*/ UPlotChart, usePanelContext, useTheme2, VizLayout } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { XYChartOptions } from './types';
//import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
//import { getXYDimensions } from './dims';
import { prepDims, prepLookup, prepConfig } from './utils';

interface XYChartPanelProps extends PanelProps<XYChartOptions> {}

export const XYChartPanel: React.FC<XYChartPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onFieldConfigChange,
}) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const config = useMemo(() => {
    // dim mapping from panel config
    const dims = prepDims(options, data.series);
    // seriesIndex enumerator & fast lookup cache (displayName <-> seriesIndex <-> DataFrameFieldIndex)
    const lookup = prepLookup(dims, data.series);
    // initial uplot config, custom renderer, data prepper, can be extended by plugins or children of vis component below
    return prepConfig({
      frames: data.series,
      lookup,
      eventBus,
      theme,
      ...options,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, options]); // optionsRev?

  // enumerates field.state.seriesIdx based on internal lookup
  // preps data in various shapes...aligned, stacked, merged, interpolated, etc..
  const preparedData = useMemo(() => config.prepData!(data.series), [config, data.series]);

  /*
  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, frames));
    },
    [fieldConfig, onFieldConfigChange, frames]
  );
  */

  /*
  if (dims.error) {
    return (
      <div>
        <div>ERROR: {dims.error}</div>
        {dims.hasData && (
          <div>
            <Button onClick={() => alert('TODO, switch vis')}>Show as Table</Button>
            {dims.hasTime && <Button onClick={() => alert('TODO, switch vis')}>Show as Time series</Button>}
          </div>
        )}
      </div>
    );
  }
  */

  /*
  if (options.mode === 'scatter') {
    const series = prepareSeries(options, data.series)[0];
    return (
      <div style={{ height, overflow: 'scroll' }}>
        <h2>TODO, scatter {series.name}</h2>
        {series.x!.values.toArray().map((v: number, i: number) => (
          <div key={i}>
            {`${v}`} -- color: {series.color.get(i)} -- size: {series.size!.get(i)}
            {series.label && <span>&nbsp; -- {series.label.get(i)}</span>}
          </div>
        ))}
      </div>
    );
  }
  */

  return (
    <VizLayout width={width} height={height}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart config={config} data={preparedData} width={vizWidth} height={vizHeight} timeRange={timeRange}>
          {/*children ? children(config, alignedFrame) : null*/}
        </UPlotChart>
      )}
    </VizLayout>
  );
};

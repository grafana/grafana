import React, { useMemo } from 'react';
import { UPlotChart, UPlotConfigBuilder, usePanelContext, useTheme2, VizLayout } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { XYChartOptions } from './models.gen';
import { prepDims, prepLookup, prepConfig } from './utils';
import { AlignedData } from '@grafana/data/src/transformations/transformers/joinDataFrames';

interface XYChartPanelProps extends PanelProps<XYChartOptions> {}

export const XYChartPanel: React.FC<XYChartPanelProps> = ({
  data,
  timeRange,
  //timeZone,
  width,
  height,
  options,
  //fieldConfig,
  //onFieldConfigChange,
}) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const { warn, config } = useMemo(() => {
    // dim mapping from panel config
    const { warn, series } = prepDims(options, data.series);
    if (warn) {
      return { warn, config: new UPlotConfigBuilder() };
    }

    // seriesIndex enumerator & fast lookup cache (displayName <-> seriesIndex <-> DataFrameFieldIndex)
    const lookup = prepLookup(series, data.series);
    // initial uplot config, custom renderer, data prepper, can be extended by plugins or children of vis component below
    return {
      config: prepConfig({
        frames: data.series,
        lookup,
        eventBus,
        theme,
        ...options,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, options]); // optionsRev?

  // enumerates field.state.seriesIdx based on internal lookup
  // preps data in various shapes...aligned, stacked, merged, interpolated, etc..
  const preparedData = useMemo(() => (warn ? (([] as unknown) as AlignedData) : config.prepData!(data.series)), [
    warn,
    config,
    data.series,
  ]);

  if (warn) {
    return (
      <div className="panel-empty">
        <p>{warn}</p>
      </div>
    );
  }

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

  if (true) {
    return <div>{JSON.stringify(config, null, 2)}</div>;
  }

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

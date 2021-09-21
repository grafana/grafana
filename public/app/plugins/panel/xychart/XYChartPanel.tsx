import React, { useMemo } from 'react';
import { LegendDisplayMode, VizLayout, VizLegend, VizLegendItem } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { XYChartOptions } from './models.gen';
import { prepareScatterData, prepareScatterPlot } from './scatter';

interface XYChartPanelProps extends PanelProps<XYChartOptions> {}

export const XYChartPanel: React.FC<XYChartPanelProps> = ({
  data,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  //onFieldConfigChange,
}) => {
  const info = useMemo(() => {
    return prepareScatterPlot(options, data, timeZone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, options, timeZone]);

  // enumerates field.state.seriesIdx based on internal lookup
  // preps data in various shapes...aligned, stacked, merged, interpolated, etc..
  const scatterData = useMemo(() => prepareScatterData(info, data.series), [info, data.series]);

  const legend = useMemo(() => {
    const items: VizLegendItem[] = [];
    for (const s of info.series) {
      const frame = s.frame(data.series);
      if (frame) {
        for (const item of s.legend(frame)) {
          items.push(item);
        }
      }
    }

    return (
      <VizLayout.Legend placement="bottom">
        <VizLegend placement="bottom" items={items} displayMode={LegendDisplayMode.List} />
      </VizLayout.Legend>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (info.error) {
    return (
      <div className="panel-empty">
        <p>{info.error}</p>
      </div>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={legend}>
      {(vizWidth: number, vizHeight: number) => (
        <pre style={{ width: vizWidth, height: vizHeight, border: '1px solid green', margin: '0px' }}>
          {JSON.stringify(scatterData, null, 2)}
        </pre>
        // <UPlotChart config={config} data={preparedData} width={vizWidth} height={vizHeight} timeRange={timeRange}>
        //   {/*children ? children(config, alignedFrame) : null*/}
        // </UPlotChart>
      )}
    </VizLayout>
  );
};

import React, { useMemo } from 'react';
import { ContextMenuPlugin, PlotLegend, TooltipPlugin, UPlotChart, ZoomPlugin } from '@grafana/ui';
import { getTimeField, PanelProps, transformDataFrame } from '@grafana/data';
import { Options } from './types';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onOptionsChange,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const alignedData = useMemo(() => {
    if (!data || !data.series?.length) {
      return null;
    }
    const dataFramesToPlot = data.series.filter(f => {
      let { timeIndex } = getTimeField(f);
      // filter out series without time index or if the time column is the only one (i.e. after transformations)
      // won't live long as we gona move out from assuming x === time
      return timeIndex !== undefined ? f.fields.length > 1 : false;
    });

    // uPlot data needs to be aligned on x-axis (ref. https://github.com/leeoniya/uPlot/issues/108)
    // For experimentation just assuming alignment on time field, needs to change
    return transformDataFrame(
      [
        {
          id: 'seriesToColumns',
          options: { byField: 'Time' },
        },
      ],
      dataFramesToPlot
    )[0];
  }, [data]);

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <UPlotChart data={alignedData} timeRange={timeRange} width={width} height={height}>
      <PlotLegend />
      <TooltipPlugin mode={options.tooltipOptions.mode as any} />

      {/*<AnnotationsEditorPlugin*/}
      {/*  onAnnotationCreate={() => {*/}
      {/*    console.log('Annotation created');*/}
      {/*  }}*/}
      {/*/>*/}

      <ZoomPlugin
        onZoom={range => {
          console.log(range);
          onChangeTimeRange(range);
        }}
      />
      <ContextMenuPlugin />
    </UPlotChart>

    // <MicroPlot
    //   timeRange={timeRange}
    //   timeZone={timeZone}
    //   realTimeUpdates={options.graph.realTimeUpdates}
    //   width={width}
    //   height={height}
    //   data={data.series}
    //   theme={config.theme}
    // />
  );
};

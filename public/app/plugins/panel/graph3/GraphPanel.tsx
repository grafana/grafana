import React, { useMemo } from 'react';
import {
  ContextMenuPlugin,
  TooltipPlugin,
  UPlotChart,
  ZoomPlugin,
  LegendPlugin,
  Canvas,
  LegendDisplayMode,
} from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { alignAndSortDataFramesByFieldName } from './utils';
import { VizLayout } from './VizLayout';

interface GraphPanelProps extends PanelProps<Options> {}

const TIME_FIELD_NAME = 'Time';

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onChangeTimeRange,
}) => {
  const alignedData = useMemo(() => {
    if (!data || !data.series?.length) {
      return null;
    }
    return alignAndSortDataFramesByFieldName(data.series, TIME_FIELD_NAME);
  }, [data]);

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <VizLayout width={width} height={height}>
      {({ builder, getLayout }) => {
        const layout = getLayout();
        const canvasSize = layout.isReady
          ? {
              width: width - (layout.left.width + layout.right.width),
              height: height - (layout.top.height + layout.bottom.height),
            }
          : { width: 0, height: 0 };

        if (options.legend.isVisible) {
          builder.addSlot(
            options.legend.placement,
            <LegendPlugin
              placement={options.legend.placement}
              displayMode={options.legend.asTable ? LegendDisplayMode.Table : LegendDisplayMode.List}
            />
          );
        } else {
          builder.clearSlot(options.legend.placement);
        }

        return (
          <UPlotChart data={alignedData} timeRange={timeRange} timeZone={timeZone} {...canvasSize}>
            {builder.addSlot('canvas', <Canvas />).render()}
            <ZoomPlugin onZoom={onChangeTimeRange} />
            <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
            <ContextMenuPlugin />
          </UPlotChart>
        );
      }}
    </VizLayout>
  );
};

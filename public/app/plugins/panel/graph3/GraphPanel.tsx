import React from 'react';
import {
  Canvas,
  ContextMenuPlugin,
  LegendDisplayMode,
  LegendPlugin,
  TooltipPlugin,
  ZoomPlugin,
  GraphNG,
} from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { VizLayout } from './VizLayout';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FC<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onChangeTimeRange,
}) => {
  return (
    <VizLayout width={width} height={height}>
      {({ builder, getLayout }) => {
        const layout = getLayout();
        // when all layout slots are ready we can calculate the canvas(actual viz) size
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
          <GraphNG data={data.series} timeRange={timeRange} timeZone={timeZone} {...canvasSize}>
            {builder.addSlot('canvas', <Canvas />).render()}
            <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
            <ZoomPlugin onZoom={onChangeTimeRange} />
            <ContextMenuPlugin />

            {data.annotations && <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} />}
            {data.annotations && <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} />}
            {/* TODO: */}
            {/*<AnnotationsEditorPlugin />*/}
          </GraphNG>
        );
      }}
    </VizLayout>
  );
};

import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';
import {
  AxisPlacement,
  ScaleDirection,
  ScaleOrientation,
  UPlotChart,
  UPlotConfigBuilder,
  useTheme2,
  VizLayout,
} from '@grafana/ui';
import { prepareHeatmapData } from './fields';
import { PanelDataErrorView } from '@grafana/runtime';
import { PanelOptions } from './models.gen';
import { countsToFills, heatmapPaths } from './render';
import { palettes9 } from './palettes';

interface HeatmapPanelProps extends PanelProps<PanelOptions> {}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const theme = useTheme2();

  const info = useMemo(() => prepareHeatmapData(data?.series, options, theme), [data, options, theme]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palette = useMemo(() => palettes9.Oranges.slice().reverse(), [options, theme]);

  const builder = useMemo(() => {
    let builder = new UPlotConfigBuilder(timeZone);

    builder.setMode(2);

    builder.addScale({
      scaleKey: 'x',
      isTime: true,
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      range: [timeRange.from.valueOf(), timeRange.to.valueOf()],
    });

    builder.addAxis({
      scaleKey: 'x',
      placement: AxisPlacement.Bottom,
      theme: theme,
    });

    builder.addScale({
      scaleKey: 'y',
      isTime: false,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
    });

    builder.addAxis({
      scaleKey: 'y',
      placement: AxisPlacement.Left,
      theme: theme,
    });

    builder.addSeries({
      facets: [
        {
          scale: 'x',
          auto: true,
          sorted: 1,
        },
        {
          scale: 'y',
          auto: true,
        },
      ],
      pathBuilder: heatmapPaths({
        disp: {
          fill: {
            values: (u, seriesIdx) => countsToFills(u, seriesIdx, palette),
            index: palette,
          },
        },
      }),
      theme,
      scaleKey: '', // facets' scales used (above)
    });

    return builder;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  if (info.warning || !info.heatmap) {
    return <PanelDataErrorView panelId={id} data={data} needsNumberField={true} message={info.warning} />;
  }

  const facets = [null, info.heatmap.fields.map((f) => f.values.toArray())];

  //console.log(facets);

  return (
    <>
      <VizLayout width={width} height={height}>
        {(vizWidth: number, vizHeight: number) => (
          // <pre style={{ width: vizWidth, height: vizHeight, border: '1px solid green', margin: '0px' }}>
          //   {JSON.stringify(scatterData, null, 2)}
          // </pre>
          <UPlotChart config={builder} data={facets!} width={vizWidth} height={vizHeight} timeRange={timeRange}>
            {/*children ? children(config, alignedFrame) : null*/}
          </UPlotChart>
        )}
      </VizLayout>
      {/* <Portal>
          {hover && (
            <VizTooltipContainer position={{ x: hover.pageX, y: hover.pageY }} offset={{ x: 10, y: 10 }}>
              <TooltipView series={series[hover.scatterIndex]} rowIndex={hover.xIndex} data={data.series} />
            </VizTooltipContainer>
          )}
        </Portal> */}
    </>
  );
};

import React, { useCallback, useMemo, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { Portal, UPlotChart, useTheme2, VizLayout, VizTooltipContainer } from '@grafana/ui';
import { prepareHeatmapData } from './fields';
import { PanelDataErrorView } from '@grafana/runtime';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import { HeatmapHoverEvent, prepConfig } from './utils';
import { DataHoverView } from '../geomap/components/DataHoverView';

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

  const info = useMemo(() => prepareHeatmapData(data.series, options, theme), [data, options, theme]);

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  const builder = useMemo(() => {
    return prepConfig({
      data: info,
      theme,
      onhover,
      timeZone,
      timeRange,
      palette,
    });
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
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight} timeRange={timeRange}>
            {/*children ? children(config, alignedFrame) : null*/}
          </UPlotChart>
        )}
      </VizLayout>
      <Portal>
        {hover && (
          <VizTooltipContainer position={{ x: hover.pageX, y: hover.pageY }} offset={{ x: 10, y: 10 }}>
            <DataHoverView data={info.heatmap} rowIndex={hover.xIndex} columnIndex={hover.yIndex} />
          </VizTooltipContainer>
        )}
      </Portal>
    </>
  );
};

import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2, PanelProps, reduceField, ReducerID, TimeRange, DataFrame } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Portal, UPlotChart, useStyles2, useTheme2, VizLayout, LegendDisplayMode, usePanelContext } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';

import { HeatmapHoverView } from './HeatmapHoverView';
import { HeatmapData, prepareHeatmapData, calculatUsingExistingHeatmap, findAndPrepareHeatmapData } from './fields';
import { ExemplarTab } from './hovertabs/ExemplarTab';
import { HeatmapTab } from './hovertabs/HeatmapTab';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import {
  findExemplarFrameInPanelData,
  findDataFramesInPanelData,
  HeatmapHoverEvent,
  prepConfig,
  getDataMapping,
  resolveMappingToData,
} from './utils';

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
  const styles = useStyles2(getStyles);

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const [info, infoMapping, exemplars, exemplarMapping, exemplarPalette] = useMemo(
    () => findAndPrepareHeatmapData(data, options, theme),
    [data, options, theme]
  );

  const facets = useMemo(() => [null, info?.heatmap?.fields.map((f) => f.values.toArray())], [info.heatmap]);
  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const isToolTipOpen = useRef<boolean>(false);
  const { onSplitOpen } = usePanelContext();

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setShouldDisplayCloseButton(false);
    onhover(null);
  };

  const onclick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  // ugh
  const dataRef = useRef<HeatmapData>(info);
  dataRef.current = info!;

  const builder = useMemo(() => {
    return prepConfig({
      dataRef,
      theme,
      onhover: onhover,
      onclick: options.tooltip.show ? onclick : null,
      onzoom: (evt) => {
        onChangeTimeRange({ from: evt.xMin, to: evt.xMax });
      },
      isToolTipOpen,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      palette,
      cellGap: options.cellGap,
      hideThreshold: options.hideThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  builder.addHook('draw', (u: uPlot) => {
    ExemplarsPlugin({
      u,
      exemplars: exemplars!,
      config: builder,
      theme: {
        ...theme,
        visualization: {
          ...theme.visualization,
          palette: exemplarPalette,
        },
      },
      options,
    });
  });

  const renderLegend = () => {
    if (options.legend.displayMode === LegendDisplayMode.Hidden || !info.heatmap) {
      return null;
    }

    const field = info.heatmap.fields[2];
    const { min, max } = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });

    let hoverValue: number | undefined = undefined;
    if (hover && info.heatmap?.fields) {
      const countField = info.heatmap?.fields[2];
      hoverValue = countField?.values.get(hover.index);
    }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <div className={styles.colorScaleWrapper}>
          <ColorScale hoverValue={hoverValue} colorPalette={palette} min={min} max={max} display={info.display} />
        </div>
      </VizLayout.Legend>
    );
  };

  if (info.warning || !info.heatmap) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        needsNumberField={true}
        message={info.warning}
      />
    );
  }

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight} timeRange={timeRange} />
        )}
      </VizLayout>
      <Portal>
        {hover && (
          <HeatmapHoverView
            ttip={{
              layers: [
                HeatmapTab({
                  data: resolveMappingToData(data.series[0], infoMapping[hover.index], onSplitOpen, timeRange),
                  heatmapData: info,
                  index: hover.index,
                  options: { showHistogram: options.tooltip.yHistogram, timeZone },
                }),
                ExemplarTab({
                  data: resolveMappingToData(
                    data.annotations?.[0]!,
                    exemplarMapping[hover?.index],
                    onSplitOpen,
                    timeRange
                  ),
                  heatmapData: exemplars!,
                  index: hover?.index,
                  options: { timeZone },
                }),
              ],
              hover,
              point: {},
            }}
            isOpen={shouldDisplayCloseButton}
            onClose={onCloseToolTip}
          />
        )}
      </Portal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  colorScaleWrapper: css`
    margin-left: 25px;
    padding: 10px 0;
  `,
});

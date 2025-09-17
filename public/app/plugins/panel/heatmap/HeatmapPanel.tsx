import { css } from '@emotion/css';
import { useMemo, useRef, useState } from 'react';

import { DashboardCursorSync, PanelProps, TimeRange } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { ScaleDistributionConfig } from '@grafana/schema';
import {
  ScaleDistribution,
  TooltipPlugin2,
  TooltipDisplayMode,
  UPlotChart,
  usePanelContext,
  useStyles2,
  useTheme2,
  VizLayout,
  EventBusPlugin,
} from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/internal';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';

import { AnnotationsPlugin2 } from '../timeseries/plugins/AnnotationsPlugin2';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';

import { HeatmapTooltip } from './HeatmapTooltip';
import { prepareHeatmapData } from './fields';
import { quantizeScheme } from './palettes';
import { Options } from './types';
import { prepConfig } from './utils';

interface HeatmapPanelProps extends PanelProps<Options> {}

export const HeatmapPanel = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  eventBus,
  onChangeTimeRange,
  replaceVariables,
}: HeatmapPanelProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { sync, eventsScope, canAddAnnotations, onSelectRange, canExecuteActions } = usePanelContext();
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

  // temp range set for adding new annotation set by TooltipPlugin2, consumed by AnnotationPlugin2
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const info = useMemo(() => {
    try {
      return prepareHeatmapData({
        frames: data.series,
        annotations: data.annotations,
        options,
        palette,
        theme,
        replaceVariables,
        timeRange,
      });
    } catch (ex) {
      return { warning: `${ex}` };
    }
  }, [data.series, data.annotations, options, palette, theme, replaceVariables, timeRange]);

  const facets = useMemo(() => {
    let exemplarsXFacet: number[] | undefined = []; // "Time" field
    let exemplarsYFacet: Array<number | undefined> = [];

    const meta = readHeatmapRowsCustomMeta(info.heatmap);

    if (info.exemplars?.length) {
      exemplarsXFacet = info.exemplars?.fields[0].values;

      // render by match on ordinal y label
      if (meta.yMatchWithLabel) {
        // ordinal/labeled heatmap-buckets?
        const hasLabeledY = meta.yOrdinalDisplay != null;

        if (hasLabeledY) {
          let matchExemplarsBy = info.exemplars?.fields.find((field) => field.name === meta.yMatchWithLabel)!.values;
          exemplarsYFacet = matchExemplarsBy.map((label) => meta.yOrdinalLabel?.indexOf(label));
        } else {
          exemplarsYFacet = info.exemplars?.fields[1].values; // "Value" field
        }
      }
      // render by raw value
      else {
        exemplarsYFacet = info.exemplars?.fields[1].values; // "Value" field
      }
    }

    return [null, info.heatmap?.fields.map((f) => f.values), [exemplarsXFacet, exemplarsYFacet]];
  }, [info.heatmap, info.exemplars]);

  // ugh
  const dataRef = useRef(info);
  dataRef.current = info;

  const builder = useMemo(() => {
    const scaleConfig: ScaleDistributionConfig = dataRef.current?.heatmap?.fields[1].config?.custom?.scaleDistribution;

    return prepConfig({
      dataRef,
      theme,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      cellGap: options.cellGap,
      hideLE: options.filterValues?.le,
      hideGE: options.filterValues?.ge,
      exemplarColor: options.exemplars?.color ?? 'rgba(255,0,255,0.7)',
      yAxisConfig: options.yAxis,
      ySizeDivisor: scaleConfig?.type === ScaleDistribution.Log ? +(options.calculation?.yBuckets?.value || 1) : 1,
      selectionMode: options.selectionMode,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, timeZone, data.structureRev, cursorSync]);

  const renderLegend = () => {
    if (!info.heatmap || !options.legend.show) {
      return null;
    }

    let hoverValue: number | undefined = undefined;

    // let heatmapType = dataRef.current?.heatmap?.meta?.type;
    // let isSparseHeatmap = heatmapType === DataFrameType.HeatmapCells && !isHeatmapCellsDense(dataRef.current?.heatmap!);
    // let countFieldIdx = !isSparseHeatmap ? 2 : 3;
    // const countField = info.heatmap.fields[countFieldIdx];

    // seriesIdx: 1 is heatmap layer; 2 is exemplar layer
    // if (hover && info.heatmap.fields && hover.seriesIdx === 1) {
    //   hoverValue = countField.values[hover.dataIdx];
    // }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <div className={styles.colorScaleWrapper}>
          <ColorScale
            hoverValue={hoverValue}
            colorPalette={palette}
            min={dataRef.current.heatmapColors?.minValue!}
            max={dataRef.current.heatmapColors?.maxValue!}
            display={info.display}
          />
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

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart key={builder.uid} config={builder} data={facets as any} width={vizWidth} height={vizHeight}>
            {cursorSync !== DashboardCursorSync.Off && (
              <EventBusPlugin config={builder} eventBus={eventBus} frame={info.series ?? info.heatmap} />
            )}
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={builder}
                hoverMode={
                  options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                }
                queryZoom={onChangeTimeRange}
                onSelectRange={onSelectRange}
                syncMode={cursorSync}
                syncScope={eventsScope}
                render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync) => {
                  if (enableAnnotationCreation && timeRange2 != null) {
                    setNewAnnotationRange(timeRange2);
                    dismiss();
                    return;
                  }

                  const annotate = () => {
                    let xVal = u.posToVal(u.cursor.left!, 'x');

                    setNewAnnotationRange({ from: xVal, to: xVal });
                    dismiss();
                  };

                  return (
                    <HeatmapTooltip
                      mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      dataRef={dataRef}
                      isPinned={isPinned}
                      dismiss={dismiss}
                      showHistogram={options.tooltip.yHistogram}
                      showColorScale={options.tooltip.showColorScale}
                      panelData={data}
                      annotate={enableAnnotationCreation ? annotate : undefined}
                      maxHeight={options.tooltip.maxHeight}
                      maxWidth={options.tooltip.maxWidth}
                      replaceVariables={replaceVariables}
                      canExecuteActions={userCanExecuteActions}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
            <AnnotationsPlugin2
              annotations={data.annotations ?? []}
              config={builder}
              timeZone={timeZone}
              newRange={newAnnotationRange}
              setNewRange={setNewAnnotationRange}
              canvasRegionRendering={false}
            />
            <OutsideRangePlugin config={builder} onChangeTimeRange={onChangeTimeRange} />
          </UPlotChart>
        )}
      </VizLayout>
    </>
  );
};

const getStyles = () => ({
  colorScaleWrapper: css({
    marginLeft: '25px',
    padding: '10px 0',
    maxWidth: '300px',
  }),
});

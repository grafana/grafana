import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef } from 'react';

import { DataFrame, Field, getLinksSupplier, GrafanaTheme2, PanelProps, ScopedVars, TimeRange } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { ScaleDistributionConfig } from '@grafana/schema';
import {
  ScaleDistribution,
  TooltipPlugin2,
  ZoomXPlugin,
  UPlotChart,
  usePanelContext,
  useStyles2,
  useTheme2,
  VizLayout,
} from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';

import { prepareHeatmapData } from './fields';
import { quantizeScheme } from './palettes';
import { HeatmapTooltip } from './tooltip/HeatmapTooltip';
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
  const { sync, canAddAnnotations } = usePanelContext();

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  //  necessary for enabling datalinks in hover view
  let scopedVarsFromRawData: ScopedVars[] = [];
  for (const series of data.series) {
    for (const field of series.fields) {
      if (field.state?.scopedVars) {
        scopedVarsFromRawData.push(field.state.scopedVars);
      }
    }
  }

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const getFieldLinksSupplier = useCallback(
    (exemplars: DataFrame, field: Field) => {
      return getLinksSupplier(exemplars, field, field.state?.scopedVars ?? {}, replaceVariables);
    },
    [replaceVariables]
  );

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const info = useMemo(() => {
    try {
      return prepareHeatmapData(data.series, data.annotations, options, palette, theme, getFieldLinksSupplier);
    } catch (ex) {
      return { warning: `${ex}` };
    }
  }, [data.series, data.annotations, options, palette, theme, getFieldLinksSupplier]);

  const facets = useMemo(() => {
    let exemplarsXFacet: number[] = []; // "Time" field
    let exemplarsyFacet: number[] = [];

    const meta = readHeatmapRowsCustomMeta(info.heatmap);
    if (info.exemplars?.length && meta.yMatchWithLabel) {
      exemplarsXFacet = info.exemplars?.fields[0].values;

      // ordinal/labeled heatmap-buckets?
      const hasLabeledY = meta.yOrdinalDisplay != null;

      if (hasLabeledY) {
        let matchExemplarsBy = info.exemplars?.fields.find((field) => field.name === meta.yMatchWithLabel)!.values;
        exemplarsyFacet = matchExemplarsBy.map((label) => meta.yOrdinalLabel?.indexOf(label)) as number[];
      } else {
        exemplarsyFacet = info.exemplars?.fields[1].values as number[]; // "Value" field
      }
    }

    return [null, info.heatmap?.fields.map((f) => f.values), [exemplarsXFacet, exemplarsyFacet]];
  }, [info.heatmap, info.exemplars]);

  // ugh
  const dataRef = useRef(info);
  dataRef.current = info;

  const builder = useMemo(() => {
    const scaleConfig = dataRef.current?.heatmap?.fields[1].config?.custom
      ?.scaleDistribution as ScaleDistributionConfig;

    return prepConfig({
      dataRef,
      theme,
      eventBus,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      sync,
      cellGap: options.cellGap,
      hideLE: options.filterValues?.le,
      hideGE: options.filterValues?.ge,
      exemplarColor: options.exemplars?.color ?? 'rgba(255,0,255,0.7)',
      yAxisConfig: options.yAxis,
      ySizeDivisor: scaleConfig?.type === ScaleDistribution.Log ? +(options.calculation?.yBuckets?.value || 1) : 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, timeZone, data.structureRev]);

  const renderLegend = () => {
    if (!info.heatmap || !options.legend.show) {
      return null;
    }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <div className={styles.colorScaleWrapper}>
          <ColorScale
            // hoverValue={hoverValue}
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

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight}>
            {/*children ? children(config, alignedFrame) : null*/}
            <ZoomXPlugin
              builder={builder}
              onZoom={(from, to) => {
                onChangeTimeRange({ from, to });
              }}
            />
            {options.tooltip.show && (
              <TooltipPlugin2
                config={builder}
                render={(u, dataIdxs, seriesIdx, isPinned, dismiss) => {
                  return (
                    <HeatmapTooltip
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      dataRef={dataRef}
                      isPinned={isPinned}
                      dismiss={dismiss}
                      showHistogram={options.tooltip.yHistogram}
                      showColorScale={options.tooltip.showColorScale}
                      canAnnotate={enableAnnotationCreation}
                      panelData={data}
                      replaceVars={replaceVariables}
                      scopedVars={scopedVarsFromRawData}
                    />
                  );
                }}
              />
            )}
          </UPlotChart>
        )}
      </VizLayout>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  colorScaleWrapper: css`
    margin-left: 25px;
    padding: 10px 0;
    max-width: 300px;
  `,
});

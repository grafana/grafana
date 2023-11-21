import { css } from '@emotion/css';
import React, { ReactElement, useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';

import {
  DataFrameType,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
  getLinksSupplier,
  InterpolateFunction,
  ScopedVars,
  PanelData,
  LinkModel,
  Field,
  FieldType,
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

import { renderHistogram } from './HeatmapHoverViewOld';
import { HeatmapData } from './fields';
import { calculateSparseBucketMinMax, formatMilliseconds, getFieldFromData, getHoverCellColor } from './tooltip/utils';

interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  dataRef: React.MutableRefObject<HeatmapData>;
  showHistogram?: boolean;
  showColorScale?: boolean;
  isPinned: boolean;
  dismiss: () => void;
  canAnnotate: boolean;
  panelData: PanelData;
  replaceVars: InterpolateFunction;
  scopedVars: ScopedVars[];
}

export const HeatmapHoverView = (props: Props) => {
  if (props.seriesIdx === 2) {
    return (
      <DataHoverView
        data={props.dataRef.current!.exemplars}
        rowIndex={props.dataIdxs[2]}
        header={'Exemplar'}
        padding={8}
      />
    );
  }

  return <HeatmapHoverCell {...props} />;
};

const HeatmapHoverCell = ({
  dataIdxs,
  dataRef,
  showHistogram,
  isPinned,
  canAnnotate,
  panelData,
  showColorScale = false,
  scopedVars,
  replaceVars,
  dismiss,
}: Props) => {
  const index = dataIdxs[1]!;
  const data = dataRef.current;

  const [isSparse] = useState(
    () => data.heatmap?.meta?.type === DataFrameType.HeatmapCells && !isHeatmapCellsDense(data.heatmap)
  );

  const xField = getFieldFromData(data.heatmap!, 'x', isSparse);
  const yField = getFieldFromData(data.heatmap!, 'y', isSparse);
  const countField = getFieldFromData(data.heatmap!, 'count', isSparse);

  const xDisp = (v: number) => {
    if (xField?.display) {
      return formattedValueToString(xField.display(v));
    }
    if (xField?.type === FieldType.time) {
      const tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
      const dashboard = getDashboardSrv().getCurrent();
      return dashboard?.formatDate(v, tooltipTimeFormat);
    }
    return `${v}`;
  };

  const xVals = xField?.values;
  const yVals = yField?.values;
  const countVals = countField?.values;

  // labeled buckets
  const meta = readHeatmapRowsCustomMeta(data.heatmap);
  const yDisp = yField?.display ? (v: string) => formattedValueToString(yField.display!(v)) : (v: string) => `${v}`;

  const yValueIdx = index % data.yBucketCount! ?? 0;

  let interval = xField?.config.interval;

  let yBucketMin: string;
  let yBucketMax: string;

  let xBucketMin: number;
  let xBucketMax: number;

  let nonNumericOrdinalDisplay: string | undefined = undefined;

  if (isSparse) {
    if (xVals && yVals) {
      const bucketsMinMax = calculateSparseBucketMinMax(data!, xVals, yVals, index);
      xBucketMin = bucketsMinMax.xBucketMin;
      xBucketMax = bucketsMinMax.xBucketMax;
      yBucketMin = bucketsMinMax.yBucketMin;
      yBucketMax = bucketsMinMax.yBucketMax;
    }
  } else {
    if (meta.yOrdinalDisplay) {
      const yMinIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx - 1 : yValueIdx;
      const yMaxIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx : yValueIdx + 1;
      yBucketMin = yMinIdx < 0 ? meta.yMinDisplay! : `${meta.yOrdinalDisplay[yMinIdx]}`;
      yBucketMax = `${meta.yOrdinalDisplay[yMaxIdx]}`;

      // e.g. "pod-xyz123"
      if (!meta.yOrdinalLabel || Number.isNaN(+meta.yOrdinalLabel[0])) {
        nonNumericOrdinalDisplay = data.yLayout === HeatmapCellLayout.le ? yBucketMax : yBucketMin;
      }
    } else {
      const value = yVals?.[yValueIdx];

      if (data.yLayout === HeatmapCellLayout.le) {
        yBucketMax = `${value}`;

        if (data.yLog) {
          let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
          let exp = logFn(value) - 1 / data.yLogSplit!;
          yBucketMin = `${data.yLog ** exp}`;
        } else {
          yBucketMin = `${value - data.yBucketSize!}`;
        }
      } else {
        yBucketMin = `${value}`;

        if (data.yLog) {
          let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
          let exp = logFn(value) + 1 / data.yLogSplit!;
          yBucketMax = `${data.yLog ** exp}`;
        } else {
          yBucketMax = `${value + data.yBucketSize!}`;
        }
      }
    }

    if (data.xLayout === HeatmapCellLayout.le) {
      xBucketMax = xVals?.[index];
      xBucketMin = xBucketMax - data.xBucketSize!;
    } else {
      xBucketMin = xVals?.[index];
      xBucketMax = xBucketMin + data.xBucketSize!;
    }
  }

  const count = countVals?.[index];

  const visibleFields = data.heatmap?.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const field of visibleFields ?? []) {
    const hasLinks = field.config.links && field.config.links.length > 0;

    if (hasLinks && data.heatmap) {
      const appropriateScopedVars = scopedVars.find(
        (scopedVar) =>
          scopedVar && scopedVar.__dataContext && scopedVar.__dataContext.value.field.name === nonNumericOrdinalDisplay
      );

      field.getLinks = getLinksSupplier(data.heatmap, field, appropriateScopedVars || {}, replaceVars);
    }

    if (field.getLinks) {
      const value = field.values[index];
      const display = field.display ? field.display(value) : { text: `${value}`, numeric: +value };

      field.getLinks({ calculatedValue: display, valueRowIndex: index }).forEach((link) => {
        const key = `${link.title}/${link.href}`;
        if (!linkLookup.has(key)) {
          links.push(link);
          linkLookup.add(key);
        }
      });
    }
  }

  let can = useRef<HTMLCanvasElement>(null);

  let histCssWidth = 264;
  let histCssHeight = 64;
  let histCanWidth = Math.round(histCssWidth * uPlot.pxRatio);
  let histCanHeight = Math.round(histCssHeight * uPlot.pxRatio);

  useEffect(
    () => {
      if (showHistogram && xVals != null && countVals != null) {
        renderHistogram(can, histCanWidth, histCanHeight, xVals, countVals, index, data.yBucketCount!);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  const { cellColor, colorPalette } = getHoverCellColor(data, index);

  const getLabelValue = (): LabelValue[] => {
    return [
      {
        label: getFieldDisplayName(countField!, data.heatmap),
        value: data.display!(count),
        color: cellColor ?? '#FFF',
        colorIndicator: ColorIndicator.value,
      },
    ];
  };

  const getHeaderLabel = (): LabelValue => {
    if (nonNumericOrdinalDisplay) {
      return { label: 'Name', value: nonNumericOrdinalDisplay };
    }

    switch (data.yLayout) {
      case HeatmapCellLayout.unknown:
        return { label: '', value: yDisp(yBucketMin) };
    }

    return {
      label: 'Bucket',
      value: `${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
    };
  };

  // Color scale
  const getCustomValueDisplay = (): ReactElement | null => {
    if (colorPalette && showColorScale) {
      return (
        <ColorScale
          colorPalette={colorPalette}
          min={data.heatmapColors?.minValue!}
          max={data.heatmapColors?.maxValue!}
          display={data.display}
          hoverValue={count}
        />
      );
    }

    return null;
  };

  const getContentLabelValue = (): LabelValue[] => {
    let fromToInt = [
      {
        label: 'From',
        value: xDisp(xBucketMin)!,
      },
    ];

    if (data.xLayout !== HeatmapCellLayout.unknown) {
      fromToInt.push({ label: 'To', value: xDisp(xBucketMax)! });

      if (interval) {
        const formattedString = formatMilliseconds(interval);
        fromToInt.push({ label: 'Interval', value: formattedString });
      }
    }

    return fromToInt;
  };

  const getCustomContent = (): ReactElement | null => {
    if (showHistogram) {
      return (
        <canvas
          width={histCanWidth}
          height={histCanHeight}
          ref={can}
          style={{ width: histCssWidth + 'px', height: histCssHeight + 'px' }}
        />
      );
    }

    return null;
  };

  // @TODO remove this when adding annotations support
  canAnnotate = false;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader
        headerLabel={getHeaderLabel()}
        keyValuePairs={getLabelValue()}
        customValueDisplay={getCustomValueDisplay()}
      />
      <VizTooltipContent contentLabelValue={getContentLabelValue()} customContent={getCustomContent()} />
      {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={canAnnotate} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
  }),
});

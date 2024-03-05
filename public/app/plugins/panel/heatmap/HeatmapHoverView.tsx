import React, { ReactElement, useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';

import {
  DataFrameType,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  getLinksSupplier,
  InterpolateFunction,
  LinkModel,
  PanelData,
  ScopedVars,
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import { TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, ColorPlacement, VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

import { getStyles } from '../timeseries/TimeSeriesTooltip';

import { HeatmapData } from './fields';
import { renderHistogram } from './renderHistogram';
import { formatMilliseconds, getFieldFromData, getHoverCellColor, getSparseCellMinMax } from './tooltip/utils';

interface Props {
  mode: TooltipDisplayMode;
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  dataRef: React.MutableRefObject<HeatmapData>;
  showHistogram?: boolean;
  showColorScale?: boolean;
  isPinned: boolean;
  dismiss: () => void;
  panelData: PanelData;
  replaceVars: InterpolateFunction;
  scopedVars: ScopedVars[];
  annotate?: () => void;
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
  showColorScale = false,
  scopedVars,
  replaceVars,
  mode,
  annotate,
}: Props) => {
  const index = dataIdxs[1]!;
  const data = dataRef.current;

  const [isSparse] = useState(
    () => data.heatmap?.meta?.type === DataFrameType.HeatmapCells && !isHeatmapCellsDense(data.heatmap)
  );

  const xField = getFieldFromData(data.heatmap!, 'x', isSparse)!;
  const yField = getFieldFromData(data.heatmap!, 'y', isSparse)!;
  const countField = getFieldFromData(data.heatmap!, 'count', isSparse)!;

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

  const xVals = xField.values;
  const yVals = yField.values;
  const countVals = countField.values;

  // labeled buckets
  const meta = readHeatmapRowsCustomMeta(data.heatmap);
  const yDisp = yField?.display ? (v: string) => formattedValueToString(yField.display!(v)) : (v: string) => `${v}`;

  let interval = xField?.config.interval;

  let yBucketMin: string;
  let yBucketMax: string;

  let xBucketMin: number;
  let xBucketMax: number;

  let nonNumericOrdinalDisplay: string | undefined = undefined;

  let contentItems: VizTooltipItem[] = [];

  const getYValueIndex = (idx: number) => {
    return idx % data.yBucketCount! ?? 0;
  };

  let yValueIdx = getYValueIndex(index);

  const getData = (idx: number = index) => {
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
      xBucketMax = xVals[idx];
      xBucketMin = xBucketMax - data.xBucketSize!;
    } else {
      xBucketMin = xVals[idx];
      xBucketMax = xBucketMin + data.xBucketSize!;
    }
  };

  if (isSparse) {
    ({ xBucketMin, xBucketMax, yBucketMin, yBucketMax } = getSparseCellMinMax(data!, index));
  } else {
    getData();
  }

  const { cellColor, colorPalette } = getHoverCellColor(data, index);

  const getDisplayData = (fromIdx: number, toIdx: number) => {
    let vals = [];
    for (let idx = fromIdx; idx <= toIdx; idx++) {
      if (!countVals?.[idx]) {
        continue;
      }

      const color = getHoverCellColor(data, idx).cellColor;
      count = getCountValue(idx);

      if (isSparse) {
        ({ xBucketMin, xBucketMax, yBucketMin, yBucketMax } = getSparseCellMinMax(data!, idx));
      } else {
        yValueIdx = getYValueIndex(idx);
        getData(idx);
      }

      const { label, value } = getContentLabels()[0];

      vals.push({
        label,
        value,
        color: color ?? '#FFF',
        isActive: index === idx,
      });
    }

    return vals;
  };

  const getContentLabels = (): VizTooltipItem[] => {
    const isMulti = mode === TooltipDisplayMode.Multi && !isPinned;

    if (nonNumericOrdinalDisplay) {
      return isMulti
        ? [{ label: `Name ${nonNumericOrdinalDisplay}`, value: data.display!(count) }]
        : [{ label: 'Name', value: nonNumericOrdinalDisplay }];
    }

    switch (data.yLayout) {
      case HeatmapCellLayout.unknown:
        return isMulti
          ? [{ label: yDisp(yBucketMin), value: data.display!(count) }]
          : [{ label: '', value: yDisp(yBucketMin) }];
    }

    return isMulti
      ? [
          {
            label: `Bucket ${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
            value: data.display!(count),
          },
        ]
      : [
          {
            label: 'Bucket',
            value: `${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
          },
        ];
  };

  const getCountValue = (idx: number) => {
    return countVals?.[idx];
  };

  let count = getCountValue(index);

  if (mode === TooltipDisplayMode.Single || isPinned) {
    const fromToInt: VizTooltipItem[] = interval ? [{ label: 'Duration', value: formatMilliseconds(interval) }] : [];

    contentItems = [
      {
        label: getFieldDisplayName(countField, data.heatmap),
        value: data.display!(count),
        color: cellColor ?? '#FFF',
        colorPlacement: ColorPlacement.trailing,
        colorIndicator: ColorIndicator.value,
      },
      ...getContentLabels(),
      ...fromToInt,
    ];
  }

  if (mode === TooltipDisplayMode.Multi && !isPinned) {
    let xVal = xField.values[index];
    let fromIdx = index;
    let toIdx = index;

    while (xField.values[fromIdx - 1] === xVal) {
      fromIdx--;
    }

    while (xField.values[toIdx + 1] === xVal) {
      toIdx++;
    }

    const vals: VizTooltipItem[] = getDisplayData(fromIdx, toIdx);
    vals.forEach((val) => {
      contentItems.push({
        label: val.label,
        value: val.value,
        color: val.color ?? '#FFF',
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
        isActive: val.isActive,
      });
    });
  }

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
      if (showHistogram && xVals != null && countVals != null && mode === TooltipDisplayMode.Single) {
        renderHistogram(can, histCanWidth, histCanHeight, xVals, countVals, index, data.yBucketCount!);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  const headerItem: VizTooltipItem = {
    label: '',
    value: xDisp(xBucketMax!)!,
  };

  let customContent: ReactElement[] = [];

  if (mode === TooltipDisplayMode.Single) {
    // Histogram
    if (showHistogram && !isSparse) {
      customContent.push(
        <canvas
          width={histCanWidth}
          height={histCanHeight}
          ref={can}
          style={{ width: histCssWidth + 'px', height: histCssHeight + 'px' }}
        />
      );
    }

    // Color scale
    if (colorPalette && showColorScale) {
      customContent.push(
        <ColorScale
          colorPalette={colorPalette}
          min={data.heatmapColors?.minValue!}
          max={data.heatmapColors?.maxValue!}
          display={data.display}
          hoverValue={count}
        />
      );
    }
  }

  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent items={contentItems} isPinned={isPinned}>
        {customContent?.map((content, i) => (
          <div key={i} style={{ padding: `${theme.spacing(1)} 0` }}>
            {content}
          </div>
        ))}
      </VizTooltipContent>
      {(links.length > 0 || isPinned) && (
        <VizTooltipFooter dataLinks={links} annotate={isPinned ? annotate : undefined} />
      )}
    </div>
  );
};

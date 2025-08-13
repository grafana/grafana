import { ReactElement, useEffect, useRef, useState, ReactNode } from 'react';
import * as React from 'react';
import uPlot from 'uplot';

import {
  ActionModel,
  DataFrameType,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  InterpolateFunction,
  LinkModel,
  PanelData,
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import { TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  VizTooltipItem,
  ColorIndicator,
  ColorPlacement,
} from '@grafana/ui/internal';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { getDisplayValuesAndLinks } from 'app/features/visualization/data-hover/DataHoverView';
import { ExemplarTooltip } from 'app/features/visualization/data-hover/ExemplarTooltip';

import { getDataLinks, getFieldActions } from '../status-history/utils';
import { isTooltipScrollable } from '../timeseries/utils';

import { HeatmapData } from './fields';
import { renderHistogram } from './renderHistogram';
import { formatMilliseconds, getFieldFromData, getHoverCellColor, getSparseCellMinMax } from './tooltip/utils';

interface HeatmapTooltipProps {
  mode: TooltipDisplayMode;
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  dataRef: React.MutableRefObject<HeatmapData>;
  showHistogram?: boolean;
  showColorScale?: boolean;
  isPinned: boolean;
  dismiss: () => void;
  panelData: PanelData;
  annotate?: () => void;
  maxHeight?: number;
  maxWidth?: number;
  replaceVariables: InterpolateFunction;
}

export const HeatmapTooltip = (props: HeatmapTooltipProps) => {
  if (props.seriesIdx === 2) {
    const dispValuesAndLinks = getDisplayValuesAndLinks(props.dataRef.current!.exemplars!, props.dataIdxs[2]!);

    if (dispValuesAndLinks == null) {
      return null;
    }

    const { displayValues, links } = dispValuesAndLinks;

    return (
      <ExemplarTooltip
        items={displayValues.map((dispVal) => ({
          label: dispVal.name,
          value: dispVal.valueString,
        }))}
        links={links}
        maxHeight={props.maxHeight}
        isPinned={props.isPinned}
      />
    );
  }

  return <HeatmapHoverCell {...props} />;
};

const defaultHistogramWidth = 264;
const defaultHistogramHeight = 64;

const HeatmapHoverCell = ({
  dataIdxs,
  dataRef,
  showHistogram,
  isPinned,
  showColorScale = false,
  mode,
  annotate,
  maxHeight,
  maxWidth,
  replaceVariables,
}: HeatmapTooltipProps) => {
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
    return idx % (data.yBucketCount ?? 1);
  };

  let yValueIdx = getYValueIndex(index);
  const xValueIdx = Math.floor(index / (data.yBucketCount ?? 1));

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

  let footer: ReactNode;

  if (isPinned) {
    let links: Array<LinkModel<Field>> = [];
    let actions: Array<ActionModel<Field>> = [];

    const linksField = data.series?.fields[yValueIdx + 1];

    if (linksField != null) {
      const visible = !Boolean(linksField.config.custom?.hideFrom?.tooltip);
      const hasLinks = (linksField.config.links?.length ?? 0) > 0;

      if (visible && hasLinks) {
        links = getDataLinks(linksField, xValueIdx);
      }

      actions = getFieldActions(data.series!, linksField, replaceVariables, xValueIdx);
    }

    footer = <VizTooltipFooter dataLinks={links} annotate={annotate} actions={actions} />;
  }

  let can = useRef<HTMLCanvasElement>(null);

  const theme = useTheme2();
  const themeSpacing = parseInt(theme.spacing(1), 10);

  let histCssWidth = Math.min(defaultHistogramWidth, maxWidth ? maxWidth - themeSpacing * 2 : defaultHistogramWidth);
  let histCssHeight = defaultHistogramHeight;
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

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      >
        {customContent?.map((content, i) => (
          <div key={i} style={{ padding: `${theme.spacing(1)} 0` }}>
            {content}
          </div>
        ))}
      </VizTooltipContent>
      {footer}
    </VizTooltipWrapper>
  );
};

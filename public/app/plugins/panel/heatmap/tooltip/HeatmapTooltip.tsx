import { css } from '@emotion/css';
import React, { ReactElement, useEffect, useRef, useState } from 'react';

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
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2 } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

import { HeatmapData } from '../fields';

import { VizTooltipContent } from './VizTooltipContent';
import { VizTooltipFooter } from './VizTooltipFooter';
import { VizTooltipHeader } from './VizTooltipHeader';
import { ColorIndicator, formatMilliseconds, getHoverCellColor, LabelValue, xDisp } from './tooltipUtils';

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

export const HeatmapTooltip = (props: Props) => {
  // exemplars
  if (props.seriesIdx === 2) {
    return <DataHoverView data={props.dataRef.current!.exemplars} rowIndex={props.dataIdxs[2]} header={'Exemplar'} />;
  }

  return <HeatmapTooltipHover {...props} />;
};

const HeatmapTooltipHover = ({
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
  const data = dataRef.current;

  const styles = useStyles2(getStyles);

  const index = dataIdxs[1]!;

  const xField = data.heatmap?.fields[0];
  const yField = data.heatmap?.fields[1];
  const countField = data.heatmap?.fields[2];

  const xVals = xField?.values;
  const yVals = yField?.values;
  const countVals = countField?.values;

  // labeled buckets
  const meta = readHeatmapRowsCustomMeta(data.heatmap);
  const yDisp = yField?.display ? (v: string) => formattedValueToString(yField.display!(v)) : (v: string) => `${v}`;

  const yValueIdx = index % data.yBucketCount! ?? 0;

  let yBucketMin: string;
  let yBucketMax: string;

  let nonNumericOrdinalDisplay: string | undefined = undefined;

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

  let xBucketMin: number;
  let xBucketMax: number;

  if (data.xLayout === HeatmapCellLayout.le) {
    xBucketMax = xVals?.[index];
    xBucketMin = xBucketMax - data.xBucketSize!;
  } else {
    xBucketMin = xVals?.[index];
    xBucketMax = xBucketMin + data.xBucketSize!;
  }

  const count = countVals?.[index];

  const visibleFields = data.heatmap?.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const field of visibleFields ?? []) {
    const hasLinks = field.config.links && field.config.links.length > 0;

    if (hasLinks && data.heatmap) {
      const appropriateScopedVars = scopedVars?.find(
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

  let histCssWidth = 132;
  let histCssHeight = 32;
  let histCanWidth = Math.round(histCssWidth * devicePixelRatio);
  let histCanHeight = Math.round(histCssHeight * devicePixelRatio);

  const minCanWidth = 264;
  const minCanHeight = 64;

  histCanWidth = histCanWidth < minCanWidth ? minCanWidth : histCanWidth;
  histCanHeight = histCanHeight < minCanHeight ? minCanHeight : histCanHeight;

  useEffect(
    () => {
      if (showHistogram) {
        let histCtx = can.current?.getContext('2d');

        if (histCtx && xVals && yVals && countVals) {
          let fromIdx = index;

          while (xVals[fromIdx--] === xVals[index]) {}

          fromIdx++;

          let toIdx = fromIdx + data.yBucketCount!;

          let maxCount = 0;

          let i = fromIdx;
          while (i < toIdx) {
            let c = countVals[i];
            maxCount = Math.max(maxCount, c);
            i++;
          }

          let pHov = new Path2D();
          let pRest = new Path2D();

          i = fromIdx;
          let j = 0;
          while (i < toIdx) {
            let c = countVals[i];

            if (c > 0) {
              let pctY = c / maxCount;
              let pctX = j / (data.yBucketCount! + 1);

              let p = i === index ? pHov : pRest;

              p.rect(
                Math.round(histCanWidth * pctX),
                Math.round(histCanHeight * (1 - pctY)),
                Math.round(histCanWidth / data.yBucketCount!),
                Math.round(histCanHeight * pctY)
              );
            }

            i++;
            j++;
          }

          histCtx.clearRect(0, 0, histCanWidth, histCanHeight);

          // create gradient
          const lGradient1 = histCtx.createLinearGradient(0, 0, 0, 150);
          lGradient1.addColorStop(0.5, '#2E3036');
          lGradient1.addColorStop(1, '#2E303600');

          histCtx.fillStyle = lGradient1;
          histCtx.fill(pRest);

          const lGradient2 = histCtx.createLinearGradient(0, 0, 0, 150);
          lGradient2.addColorStop(0, '#5794F2');
          lGradient2.addColorStop(1, '#2E303600');

          histCtx.fillStyle = lGradient2;
          histCtx.fill(pHov);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  const [isSparse] = useState(
    () => data.heatmap?.meta?.type === DataFrameType.HeatmapCells && !isHeatmapCellsDense(data.heatmap)
  );

  if (isSparse) {
    return (
      <div>
        <DataHoverView data={data.heatmap} rowIndex={index} />
      </div>
    );
  }

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
        value: xDisp(xBucketMin, xField)!,
      },
    ];

    if (data.xLayout !== HeatmapCellLayout.unknown) {
      fromToInt.push({ label: 'To', value: xDisp(xBucketMax, xField)! });

      const interval = xField?.config.interval;

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
          style={{ width: histCanWidth + 'px', height: histCanHeight + 'px' }}
        />
      );
    }

    return null;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader
        headerLabel={getHeaderLabel()}
        keyValuePairs={getLabelValue()}
        customValueDisplay={getCustomValueDisplay()}
      />
      <VizTooltipContent contentLabelValue={getContentLabelValue()} customContent={getCustomContent()} />
      {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={canAnnotate} dismiss={dismiss}/>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 280px;
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing(0.5)};
  `,
});

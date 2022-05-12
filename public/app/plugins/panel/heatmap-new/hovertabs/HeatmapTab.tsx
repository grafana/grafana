import React, { useRef, useEffect } from 'react';

import { DataFrame, ArrayVector, Field, TimeZone, dateTimeFormat, systemDateFormats } from '@grafana/data';

import { DataHoverView } from '../components/DataHoverView';
import { BucketLayout, getHeatmapFields } from '../fields';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';

interface HistogramFooterProps {
  xField: Field;
  yField: Field;
  countField: Field;
  index: number;
  yBucketCount?: number;
}

const HistogramFooter = ({ xField, yField, countField, index, yBucketCount }: HistogramFooterProps) => {
  let can = useRef<HTMLCanvasElement>(null);

  let histCssWidth = 150;
  let histCssHeight = 50;
  let histCanWidth = Math.round(histCssWidth * devicePixelRatio);
  let histCanHeight = Math.round(histCssHeight * devicePixelRatio);

  const xVals = xField.values.toArray();
  const yVals = yField.values.toArray();
  const countVals = countField?.values.toArray();

  useEffect(
    () => {
      let histCtx = can.current?.getContext('2d');

      if (histCtx && xVals && yVals && countVals) {
        let fromIdx = index;

        while (xVals[fromIdx--] === xVals[index]) {}

        fromIdx++;

        let toIdx = fromIdx + yBucketCount!;

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
            let pctX = j / (yBucketCount! + 1);

            let p = i === index ? pHov : pRest;

            p.rect(
              Math.round(histCanWidth * pctX),
              Math.round(histCanHeight * (1 - pctY)),
              Math.round(histCanWidth / yBucketCount!),
              Math.round(histCanHeight * pctY)
            );
          }

          i++;
          j++;
        }

        histCtx.clearRect(0, 0, histCanWidth, histCanHeight);

        histCtx.fillStyle = '#ffffff80';
        histCtx.fill(pRest);

        histCtx.fillStyle = '#ff000080';
        histCtx.fill(pHov);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  return (
    <>
      <canvas
        width={histCanWidth}
        height={histCanHeight}
        ref={can}
        style={{ width: histCanWidth + 'px', height: histCanHeight + 'px' }}
      />
    </>
  );
};

interface HeatmapLayerOptions {
  timeZone: TimeZone;
  showHistogram?: boolean;
}

export const HeatmapTab = ({
  heatmapData,
  index,
  options,
}: HeatmapHoverProps<HeatmapLayerOptions>): HeatmapLayerHover => {
  const [xField, yField, countField] = getHeatmapFields(heatmapData?.heatmap!);
  if (xField && yField && countField && typeof index !== 'undefined' && index >= 0 && heatmapData) {
    const yValueIdx = index % heatmapData?.yBucketCount! ?? 0;

    const yMinIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx - 1 : yValueIdx;
    const yMaxIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx : yValueIdx + 1;

    const xMin: number = xField.values.get(index);
    const xMax: number = xMin + heatmapData.xBucketSize!;
    const yMin: number = yField.values.get(yMinIdx);
    const yMax: number = yField.values.get(yMaxIdx);
    const count: number = countField.values.get(index);

    const summaryData: DataFrame = {
      fields: [
        {
          ...xField,
          config: {
            ...xField.config,
            displayNameFromDS: 'xMin',
          },
          display: (value: number) => {
            return {
              numeric: value,
              text: dateTimeFormat(value, {
                format: systemDateFormats.fullDate,
                timeZone: options?.timeZone!,
              }),
            };
          },
          state: {
            ...xField.state,
            displayName: 'xMin',
          },
          values: new ArrayVector([xMin]),
        },
        {
          ...xField,
          config: {
            ...xField.config,
            displayNameFromDS: 'xMax',
          },
          display: (value: number) => {
            return {
              numeric: value,
              text: dateTimeFormat(value, {
                format: systemDateFormats.fullDate,
                timeZone: options?.timeZone!,
              }),
            };
          },
          state: {
            ...xField.state,
            displayName: 'xMax',
          },
          values: new ArrayVector([xMax]),
        },
        {
          ...yField,
          config: {
            ...yField.config,
            displayNameFromDS: 'yMin',
          },
          state: {
            ...yField.state,
            displayName: 'yMin',
          },
          values: new ArrayVector([yMin]),
        },
        {
          ...yField,
          config: {
            ...yField.config,
            displayNameFromDS: 'yMax',
          },
          state: {
            ...yField.state,
            displayName: 'yMax',
          },
          values: new ArrayVector([yMax]),
        },
        {
          ...countField,
          values: new ArrayVector([count]),
        },
      ],
      length: 5,
    };

    const footer = () => {
      if (options?.showHistogram!) {
        return (
          <HistogramFooter
            xField={xField}
            yField={yField}
            countField={countField}
            index={index}
            yBucketCount={heatmapData.yBucketCount}
          />
        );
      }
      return <></>;
    };

    const header = () => {
      return <DataHoverView data={summaryData} rowIndex={0} />;
    };

    return {
      name: 'Heatmap',
      header,
      footer,
    };
  }

  return {
    name: 'Heatmap',
  };
};

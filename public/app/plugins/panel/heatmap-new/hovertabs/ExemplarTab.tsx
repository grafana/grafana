import React from 'react';

import { ArrayVector, DataFrame, dateTimeFormat, systemDateFormats, TimeRange, TimeZone } from '@grafana/data';

import { DataHoverView } from '../components/DataHoverView';
import { BucketLayout, getHeatmapFields } from '../fields';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';

interface HeatmapLayerOptions {
  timeZone: TimeZone;
  timeRange: TimeRange;
}

export const ExemplarTab = ({
  heatmapData,
  index,
  options,
}: HeatmapHoverProps<HeatmapLayerOptions>): HeatmapLayerHover => {
  if (!heatmapData?.heatmap) {
    return {
      name: 'Exemplar',
    };
  }
  const [xField, yField, countField] = getHeatmapFields(heatmapData?.heatmap!);
  const mapping: number[] | null = heatmapData.exemplarsMappings?.lookup[index!]!;
  const count: number = mapping?.length ?? 0;

  if (
    xField &&
    yField &&
    countField &&
    typeof count === 'number' &&
    count > 0 &&
    typeof index !== 'undefined' &&
    index >= 0
  ) {
    const yValueIdx = index % heatmapData?.yBucketCount! ?? 0;

    const yMinIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx - 1 : yValueIdx;
    const yMaxIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx : yValueIdx + 1;

    const xMin: number = xField.values.get(index);
    const xMax: number = xMin + heatmapData.xBucketSize!;
    const yMin: number = yField.values.get(yMinIdx);
    const yMax: number = yField.values.get(yMaxIdx);

    if (count === 0) {
      return {
        name: 'Exemplar',
      };
    }

    // Todo: Might be an easier way to do this, but for now, create a dataframe with fields for the summary, and use the
    // DataHoverView control.
    const summaryData: DataFrame = {
      name: 'Exemplar',
      fields: [
        {
          ...xField,
          config: {
            ...xField.config,
            displayNameFromDS: 'xMin',
          },
          state: {
            ...xField.state,
            displayName: 'xMin',
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
          values: new ArrayVector([xMin]),
        },
        {
          ...xField,
          config: {
            ...xField.config,
            displayNameFromDS: 'xMax',
          },
          state: {
            ...xField.state,
            displayName: 'xMax',
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

    const header = () => {
      return <DataHoverView data={summaryData} rowIndex={0} />;
    };

    return {
      name: 'Exemplar',
      header,
      data: heatmapData.exemplars!,
      indicies: heatmapData.exemplarsMappings?.lookup[index]!,
    };
  }

  return {
    name: 'Exemplar',
  };
};

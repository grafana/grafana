import { ArrayVector, DataFrame, TimeZone } from '@grafana/data';
import React from 'react';
import { DataHoverView } from '../components/DataHoverView';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';
import { getHeatmapFrames, timeFormatter } from '../utils';

interface HeatmapLayerOptions {
  timeZone: TimeZone;
}

export const ExemplarTab = ({
  data,
  heatmapData,
  index,
  options,
}: HeatmapHoverProps<HeatmapLayerOptions>): HeatmapLayerHover => {
  if (!heatmapData?.heatmap) {
    return {
      name: 'Exemplar',
      data: [],
    };
  }
  const [xField, yField, countField] = getHeatmapFrames(heatmapData?.heatmap!);
  if (xField && yField && countField && index && index >= 0) {
    const xMin: number = xField.values.get(index);
    const xMax: number = xMin + heatmapData.xBucketSize!;
    const yMin: number = yField.values.get(index);
    const yMax: number = yMin + heatmapData.yBucketSize!;
    const count: number = countField.values.get(index);

    if (count === 0) {
      return {
        name: 'Exemplar',
        data: [],
      };
    }

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
              text: timeFormatter(value, options?.timeZone!),
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
              text: timeFormatter(value, options?.timeZone!),
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
      data,
    };
  }

  return {
    name: 'Exemplar',
    data,
  };
};

import { ArrayVector, DataFrame, Field } from '@grafana/data';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';

export const exemplarLayer = ({ heatmapData, getValuesInCell, index }: HeatmapHoverProps): HeatmapLayerHover => {
  const xField: Field | undefined = heatmapData.heatmap?.fields.find((f) => f.name === 'xMin');
  const yField: Field | undefined = heatmapData.heatmap?.fields.find((f) => f.name === 'yMin');
  const countField: Field | undefined = heatmapData.heatmap?.fields.find((f) => f.name === 'count');

  if (xField && yField && countField) {
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

    console.log('index is', index, 'yMin', yMin, 'yMax', yMax);
    const exemplarData: DataFrame[] | undefined = getValuesInCell!({
      xRange: {
        min: xMin,
        max: xMax,
        delta: heatmapData.xBucketSize || 0,
      },
      yRange: {
        min: yMin,
        max: yMax,
        delta: heatmapData.yBucketSize || 0,
      },
      count,
    });

    if (exemplarData) {
      return {
        name: 'Exemplar',
        data: exemplarData,
      };
    }

    return {
      name: 'Exemplar',
      data: [
        {
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
              values: new ArrayVector([]),
            },
          ],
          length: 5,
        },
      ],
    };
    return {
      name: 'Exemplar',
      data: [],
    };
  }

  return {
    name: 'Exemplar',
    data: [],
  };
};

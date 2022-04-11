import { ArrayVector, Field } from '@grafana/data';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';

export const exemplarLayer = ({ data, index }: HeatmapHoverProps): HeatmapLayerHover => {
  const xField: Field | undefined = data.heatmap?.fields.find((f) => f.name === 'xMin');
  const yField: Field | undefined = data.heatmap?.fields.find((f) => f.name === 'yMin');
  const countField: Field | undefined = data.heatmap?.fields.find((f) => f.name === 'count');

  if (xField && yField && countField) {
    const xMin: number = xField.values.get(index);
    const xMax: number = xMin + data.xBucketSize!;
    const yMin: number = yField.values.get(index);
    const yMax: number = yMin + data.yBucketSize!;
    const count: number = countField.values.get(index);
    if (count === 0) {
      return {
        name: 'Exemplar',
        data: [],
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

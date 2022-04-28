import { ArrayVector, createTheme, FieldType } from '@grafana/data';

import { BucketLayout, calculatUsingExistingHeatmap } from './fields';
import { PanelOptions } from './models.gen';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: PanelOptions = {} as PanelOptions;

  it('simple test stub', () => {
    expect(theme).toBeDefined();
    expect(options).toBeDefined();
  });
});

describe('Calculate a heatmap using existing heatmap', () => {
  it('takes good data, and delivers a working data mapping', () => {
    const result = calculatUsingExistingHeatmap(
      {
        name: 'origdata',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            config: {},
            values: new ArrayVector([1, 2, 3, 4, 5, 6, 7, 8, 9]),
          },
          {
            name: 'value',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([8, 0, 8, 7, 7, 8, 6, 0, 6]),
          },
        ],
        length: 2,
      },
      {
        heatmap: {
          name: 'test',
          fields: [
            {
              name: 'xMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([1, 1, 1, 4, 4, 4, 7, 7, 7]),
            },
            {
              name: 'yMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([1, 4, 7, 1, 4, 7, 1, 4, 7]),
            },
            {
              name: 'count',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([0, 0, 0, 0, 0, 0, 0, 0, 0]),
            },
          ],
          length: 3,
        },
        xBucketCount: 3,
        xBucketSize: 3,
        xLayout: BucketLayout.ge,
        yBucketCount: 3,
        yBucketSize: 3,
        yLayout: BucketLayout.ge,
      }
    );

    expect(result.heatmap).not.toBeNull();
    expect(result.heatmap?.fields[2].values.toArray()).toEqual([0, 0, 2, 0, 0, 3, 0, 2, 0]);
  });

  it('takes good data, and delivers a working data mapping', () => {
    const result = calculatUsingExistingHeatmap(
      {
        name: 'origdata',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            config: {},
            values: new ArrayVector([1, 1.5, 2, 3, 3.5, 4, 4, 4.5, 5.1, 5.3, 5.4, 5.5, 6, 6.5, 7]),
          },
          {
            name: 'value',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([
              -1, 0.45, 0.74, 0.112, 0.6, 0.95, 1.1, 0.123, 0, 1.4, 0.625, 0.444, 0.31, 0.666, 9999,
            ]),
          },
        ],
        length: 2,
      },
      {
        heatmap: {
          name: 'test',
          fields: [
            {
              name: 'xMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([3, 3, 3, 3, 3, 4.5, 4.5, 4.5, 4.5, 4.5, 6, 6, 6, 6, 6]),
            },
            {
              name: 'yMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([0, 0.2, 0.4, 0.6, 0.8, 0, 0.2, 0.4, 0.6, 0.8, 0, 0.2, 0.4, 0.6, 0.8]),
            },
            {
              name: 'count',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
            },
          ],
          length: 3,
        },
        xBucketCount: 3,
        xBucketSize: 1.5,
        xLayout: BucketLayout.ge,
        yBucketCount: 5,
        yBucketSize: 0.2,
        yLayout: BucketLayout.ge,
      }
    );

    expect(result.heatmap).not.toBeNull();
    expect(result.heatmap?.fields[2].values.toArray()).toEqual([1, 0, 0, 1, 1, 2, 0, 1, 1, 0, 0, 1, 0, 1, 0]);
  });
});

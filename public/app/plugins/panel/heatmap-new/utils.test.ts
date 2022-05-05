import { ArrayVector, DataFrameType, FieldType } from '@grafana/data';

import { BucketLayout } from './fields';
import { getDataMapping } from './utils';

describe('creating a heatmap data mapping', () => {
  describe('generates a simple data mapping with orderly data', () => {
    const mapping = getDataMapping(
      {
        heatmap: {
          name: 'test',
          meta: {
            type: DataFrameType.HeatmapScanlines,
          },
          fields: [
            {
              name: 'xMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([1]),
            },
            {
              name: 'yMin',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([1, 4, 7]),
            },
            {
              name: 'count',
              type: FieldType.number,
              config: {},
              values: new ArrayVector([3, 3, 3]),
            },
          ],
          length: 3,
        },
        xBucketCount: 1,
        xBucketSize: 9,
        xLayout: BucketLayout.ge,
        yBucketCount: 3,
        yBucketSize: 3,
        yLayout: BucketLayout.ge,
      },
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
            values: new ArrayVector([1, 2, 3, 4, 5, 6, 7, 8, 9]),
          },
        ],
        length: 2,
      }
    );

    it('takes good data, and delivers a working data mapping', () => {
      expect(mapping.length).toEqual(3);
      expect(mapping[0]).toEqual([0, 1, 2]);
      expect(mapping[1]).toEqual([3, 4, 5]);
      expect(mapping[2]).toEqual([6, 7, 8]);
    });
  });

  describe('generates a data mapping with less orderly data (counts are different)', () => {
    const heatmap = {
      heatmap: {
        name: 'test',
        meta: {
          type: DataFrameType.HeatmapScanlines,
        },
        fields: [
          {
            name: 'xMin',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([1]),
          },
          {
            name: 'yMin',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([1, 4, 7]),
          },
          {
            name: 'count',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([2, 0, 6]),
          },
        ],
        length: 3,
      },
      xBucketCount: 1,
      xBucketSize: 9,
      xLayout: BucketLayout.ge,
      yBucketCount: 3,
      yBucketSize: 3,
      yLayout: BucketLayout.ge,
    };
    const origData = {
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
          values: new ArrayVector([7, 1, 8, 7, 2, 7, 8, 8, 4]),
        },
      ],
      length: 2,
    };

    it("Puts data into the proper buckets, when we don't care about the count", () => {
      // In this case, we are just finding proper values, but don't care if a values
      // exists in the bucket in the original data or not. Therefore, we should see
      // a value mapped into the second mapping bucket containing the value '8'.
      const mapping = getDataMapping(heatmap, origData, { requireCount: false });
      expect(mapping.length).toEqual(3);
      expect(mapping[0]).toEqual([1, 4]);
      expect(mapping[1]).toEqual([8]);
      expect(mapping[2]).toEqual([0, 2, 3, 5, 6, 7]);
    });

    it('puts data in to the proper buckets, when we do care about the count', () => {
      // In this case, the second value in the count is 0, and we are following the count.
      // Therefore, the second index of the mapping should not contain a value.
      const mapping = getDataMapping(heatmap, origData, { requireCount: true });
      expect(mapping.length).toEqual(3);
      expect(mapping[0]).toEqual([1, 4]);
      expect(mapping[1]).toEqual(null);
      expect(mapping[2]).toEqual([0, 2, 3, 5, 6, 7]);
    });

    it('puts data into the proper buckets, given min and max values in the options', () => {
      const mapping = getDataMapping(heatmap, origData, {
        requireCount: false,
        xMin: 3,
        xMax: 6,
        yMin: 3,
        yMax: 7,
      });
      expect(mapping).toEqual([null, [3, 5], null]);
    });
  });

  describe('Handles a larger data set that will not fill all buckets', () => {
    const mapping = getDataMapping(
      {
        heatmap: {
          name: 'test',
          meta: {
            type: DataFrameType.HeatmapScanlines,
          },
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
              values: new ArrayVector([0, 0, 2, 0, 0, 3, 0, 2, 0]),
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
      },
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
            values: new ArrayVector([8, 0, 8, 7, 7, 8, 6, 10, 6]),
          },
        ],
        length: 2,
      }
    );

    it('Creates the data mapping correctly', () => {
      expect(mapping.length).toEqual(9);
      expect(mapping).toEqual([null, null, [0, 2], null, null, [3, 4, 5], null, [6, 8], null]);
    });

    it('filters out minimum and maximum values', () => {
      expect(mapping.flat()).not.toContainEqual(1);
      expect(mapping.flat()).not.toContainEqual(10);
    });
  });

  describe('Error scenarios', () => {
    const heatmap = {
      heatmap: {
        name: 'test',
        meta: {
          type: DataFrameType.HeatmapBuckets,
        },
        fields: [
          {
            name: 'xMin',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([1]),
          },
          {
            name: 'yMin',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([1, 4, 7]),
          },
          {
            name: 'count',
            type: FieldType.number,
            config: {},
            values: new ArrayVector([2, 0, 6]),
          },
        ],
        length: 3,
      },
      xBucketCount: 1,
      xBucketSize: 9,
      xLayout: BucketLayout.ge,
      yBucketCount: 3,
      yBucketSize: 3,
      yLayout: BucketLayout.ge,
    };
    const origData = {
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
          values: new ArrayVector([7, 1, 8, 7, 2, 7, 8, 8, 4]),
        },
      ],
      length: 2,
    };

    it('Will not process heatmap buckets', () => {
      expect(
        getDataMapping(
          {
            ...heatmap,
            heatmap: {
              ...heatmap.heatmap,
              meta: {
                type: DataFrameType.HeatmapBuckets,
              },
            },
          },
          origData
        )
      ).toEqual([null]);

      expect(
        getDataMapping(
          {
            ...heatmap,
            heatmap: {
              ...heatmap.heatmap,
              meta: {
                type: DataFrameType.TimeSeriesWide,
              },
            },
          },
          origData
        )
      ).toEqual([null]);

      expect(
        getDataMapping(
          {
            ...heatmap,
            heatmap: {
              ...heatmap.heatmap,
              meta: {
                type: undefined,
              },
            },
          },
          origData
        )
      ).toEqual([null]);
    });
  });
});

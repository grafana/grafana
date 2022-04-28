import { ArrayVector, FieldType } from '@grafana/data';

import { BucketLayout } from './fields';
import { getDataMapping, translateMatrixIndex } from './utils';

describe('matrix', () => {
  describe('translates indicies between two bucket sizes properly', () => {
    it('translates when bucketFrom is smaller than bucketTo', () => {
      expect(translateMatrixIndex(12, 5, 10)).toEqual(22);
      expect(translateMatrixIndex(14, 5, 10)).toEqual(24);
      expect(translateMatrixIndex(16, 5, 10)).toEqual(31);
    });
    it('translates when bucketFrom is larger than bucketTo', () => {
      expect(translateMatrixIndex(14, 12, 10)).toEqual(12);
      expect(translateMatrixIndex(16, 12, 10)).toEqual(14);
      expect(translateMatrixIndex(18, 12, 10)).toEqual(16);
    });
    it('filters out items that cannot be translated', () => {
      expect(translateMatrixIndex(10, 12, 10)).toEqual(-1);
    });
    it('honours an offset when yMins are different', () => {
      expect(translateMatrixIndex(7, 3, 9, 3)).toEqual(13);
    });
  });
});

describe('getting a data mapping', () => {
  it('takes good data, and delivers a working data mapping', () => {
    const mapping = getDataMapping(
      {
        heatmap: {
          name: 'test',
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

    expect(mapping.length).toEqual(3);
    expect(mapping[0]).toEqual([0, 1, 2]);
    expect(mapping[1]).toEqual([3, 4, 5]);
    expect(mapping[2]).toEqual([6, 7, 8]);
  });

  it('takes good data, and delivers a working data mapping', () => {
    const mapping = getDataMapping(
      {
        heatmap: {
          name: 'test',
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
              values: new ArrayVector([2, 1, 6]),
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
            values: new ArrayVector([7, 1, 8, 7, 2, 7, 8, 8, 4]),
          },
        ],
        length: 2,
      }
    );

    expect(mapping.length).toEqual(3);
    expect(mapping[0]).toEqual([1, 4]);
    expect(mapping[1]).toEqual([8]);
    expect(mapping[2]).toEqual([0, 2, 3, 5, 6, 7]);
  });

  it('takes good data, and delivers a working data mapping', () => {
    const mapping = getDataMapping(
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
            values: new ArrayVector([8, 0, 8, 7, 7, 8, 6, 0, 6]),
          },
        ],
        length: 2,
      }
    );

    expect(mapping.length).toEqual(9);
    expect(mapping).toEqual([null, null, [0, 2], null, null, [3, 4, 5], null, [6, 8], null]);
  });
});

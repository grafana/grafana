import { ElasticsearchDataQuery } from './dataquery.gen';
import { flattenObject, isTimeSeriesQuery, removeEmpty } from './utils';

describe('removeEmpty', () => {
  it('Should remove all empty', () => {
    const original = {
      stringsShouldBeKept: 'Something',
      unlessTheyAreEmpty: '',
      nullToBeRemoved: null,
      undefinedToBeRemoved: null,
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      emptyObjectsShouldBeRemoved: {},
      emptyArrayShouldBeRemoved: [],
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjToBeRemoved: {
        toBeRemoved: undefined,
      },
      nestedObjectToKeep: {
        thisShouldBeRemoved: null,
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    const expectedResult = {
      stringsShouldBeKept: 'Something',
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjectToKeep: {
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    expect(removeEmpty(original)).toStrictEqual(expectedResult);
  });
});

describe('isTimeSeriesQuery', () => {
  it('should return false when given a log query', () => {
    const logsQuery: ElasticsearchDataQuery = {
      refId: `A`,
      metrics: [{ type: 'logs', id: '1' }],
    };

    expect(isTimeSeriesQuery(logsQuery)).toBe(false);
  });

  it('should return false when bucket aggs are empty', () => {
    const query: ElasticsearchDataQuery = {
      refId: `A`,
      bucketAggs: [],
    };

    expect(isTimeSeriesQuery(query)).toBe(false);
  });

  it('returns false when empty date_histogram is not last', () => {
    const query: ElasticsearchDataQuery = {
      refId: `A`,
      bucketAggs: [
        { id: '1', type: 'date_histogram' },
        { id: '2', type: 'terms' },
      ],
    };

    expect(isTimeSeriesQuery(query)).toBe(false);
  });

  it('returns true when empty date_histogram is last', () => {
    const query: ElasticsearchDataQuery = {
      refId: `A`,
      bucketAggs: [
        { id: '1', type: 'terms' },
        { id: '2', type: 'date_histogram' },
      ],
    };

    expect(isTimeSeriesQuery(query)).toBe(true);
  });
});

describe('flattenObject', () => {
  it('flattens objects of arbitrary depth', () => {
    const nestedObject = {
      a: {
        b: {
          c: 1,
          d: {
            e: 2,
            f: 3,
          },
        },
        g: 4,
      },
      h: 5,
    };

    expect(flattenObject(nestedObject)).toEqual({
      'a.b.c': 1,
      'a.b.d.e': 2,
      'a.b.d.f': 3,
      'a.g': 4,
      h: 5,
    });
  });

  it('does not alter other objects', () => {
    const nestedObject = {
      a: 'uno',
      b: 'dos',
      c: 3,
    };

    expect(flattenObject(nestedObject)).toEqual(nestedObject);
  });
});

import { ElasticsearchQuery } from './types';
import { isTimeSeriesQuery, removeEmpty } from './utils';

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
    const logsQuery: ElasticsearchQuery = {
      refId: `A`,
      metrics: [{ type: 'logs', id: '1' }],
    };

    expect(isTimeSeriesQuery(logsQuery)).toBe(false);
  });

  it('should return false when bucket aggs are empty', () => {
    const query: ElasticsearchQuery = {
      refId: `A`,
      bucketAggs: [],
    };

    expect(isTimeSeriesQuery(query)).toBe(false);
  });

  it('returns false when empty date_histogram is not last', () => {
    const query: ElasticsearchQuery = {
      refId: `A`,
      bucketAggs: [
        { id: '1', type: 'date_histogram' },
        { id: '2', type: 'terms' },
      ],
    };

    expect(isTimeSeriesQuery(query)).toBe(false);
  });

  it('returns true when empty date_histogram is last', () => {
    const query: ElasticsearchQuery = {
      refId: `A`,
      bucketAggs: [
        { id: '1', type: 'terms' },
        { id: '2', type: 'date_histogram' },
      ],
    };

    expect(isTimeSeriesQuery(query)).toBe(true);
  });
});

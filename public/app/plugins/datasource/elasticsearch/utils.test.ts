import { FieldType, LogLevel, createDataFrame } from '@grafana/data';

import { ElasticsearchQuery } from './types';
import { dataFrameLogLevel, flattenObject, isTimeSeriesQuery, logLevelMap, removeEmpty } from './utils';

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

describe('dataFrameLogLevel', () => {
  function getLogFrame(label: string, level: string) {
    return createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1] },
        {
          type: FieldType.number,
          values: [7],
          labels: {
            [label]: level
          },
        },
      ],
    });
  }

  it.each(Object.keys(logLevelMap))('returns the level from the level field of a %s log data frame', (level: string) => {
    const dataFrame = getLogFrame('level', level);
    
    expect(dataFrameLogLevel(dataFrame)).toBe(logLevelMap[level]);
  });

  it('returns unknown if the level is missing', () => {
    const dataFrame = getLogFrame('not_level', '');
    
    expect(dataFrameLogLevel(dataFrame)).toBe(LogLevel.unknown);
  });

  it('returns unknown if the level is empty', () => {
    const dataFrame = getLogFrame('level', '');
    
    expect(dataFrameLogLevel(dataFrame)).toBe(LogLevel.unknown);
  });
});

describe('flattenObject', () => {
  it('flattents objects of arbitrary depth', () => {
    const nestedObject = {
      a: {
        b: {
          c: 1,
          d: {
            e: 2,
            f: 3
          }
        },
        g: 4
      },
      h: 5
    };
    
    expect(flattenObject(nestedObject)).toEqual({
      'a.b.c': 1,
      'a.b.d.e': 2,
      'a.b.d.f': 3,
      'a.g': 4,
      'h': 5,
    });
  });

  it('does not alter other objects', () => {
    const nestedObject = {
      a: 'uno',
      b: 'dos',
      c: 3
    };
    
    expect(flattenObject(nestedObject)).toEqual(nestedObject);
  });

  it.each([undefined, false, true, ''])('does not fail for other unknown types as input', (target: undefined | boolean | string) => {
    expect(flattenObject(target)).toEqual({});
  });
});

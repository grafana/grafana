import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { getQueryHints } from './queryHints';

describe('getQueryHints', () => {
  describe('when series with json logs', () => {
    const jsonSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: new ArrayVector(['{"foo": "bar", "bar": "baz"}', '{"foo": "bar", "bar": "baz"}']),
        },
      ],
    };
    it('suggest json parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonSeries])).toMatchObject([{ type: 'ADD_JSON_PARSER' }]);
    });
    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana" | json', [jsonSeries])).toEqual([]);
    });
  });

  describe('when series with logfmt logs', () => {
    const logfmtSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: new ArrayVector(['foo="bar" bar="baz"', 'foo="bar" bar="baz"']),
        },
      ],
    };

    it('suggest logfmt parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [logfmtSeries])).toMatchObject([{ type: 'ADD_LOGFMT_PARSER' }]);
    });
    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana" | json', [logfmtSeries])).toEqual([]);
    });
  });

  describe('when series with json and logfmt logs', () => {
    const jsonAndLogfmtSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: new ArrayVector(['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"']),
        },
      ],
    };

    it('suggest logfmt parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonAndLogfmtSeries])).toMatchObject([
        { type: 'ADD_JSON_PARSER' },
        { type: 'ADD_LOGFMT_PARSER' },
      ]);
    });
    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana" | json', [jsonAndLogfmtSeries])).toEqual([]);
    });
  });

  describe('when series with level-like label', () => {
    const createSeriesWithLabel = (labelName?: string): DataFrame => {
      const labelVariable: { [key: string]: string } = { job: 'a' };
      if (labelName) {
        labelVariable[labelName] = 'error';
      }
      return {
        name: 'logs',
        length: 2,
        fields: [
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"']),
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: new ArrayVector([labelVariable, { job: 'baz', foo: 'bar' }]),
          },
        ],
      };
    };

    it('suggest level renaming when no level label', () => {
      expect(getQueryHints('{job="grafana"', [createSeriesWithLabel('lvl')])).toMatchObject([
        { type: 'ADD_JSON_PARSER' },
        { type: 'ADD_LOGFMT_PARSER' },
        { type: 'ADD_LEVEL_LABEL_FORMAT' },
      ]);
    });
    it('does not suggest level renaming if level label', () => {
      expect(getQueryHints('{job="grafana"', [createSeriesWithLabel('level')])).toMatchObject([
        { type: 'ADD_JSON_PARSER' },
        { type: 'ADD_LOGFMT_PARSER' },
      ]);
    });
  });
});

import { DataFrame, FieldType } from '@grafana/data';

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
          values: ['{"foo": "bar", "bar": "baz"}', '{"foo": "bar", "bar": "baz"}'],
        },
      ],
    };

    it('suggest json parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_JSON_PARSER' })])
      );
    });

    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana" | json', [jsonSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_JSON_PARSER' })])
      );
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
          values: ['foo="bar" bar="baz"', 'foo="bar" bar="baz"'],
        },
      ],
    };

    it('suggest logfmt parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [logfmtSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LOGFMT_PARSER' })])
      );
    });

    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana" | logfmt', [logfmtSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LOGFMT_PARSER' })])
      );
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
          values: ['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"'],
        },
      ],
    };

    it('suggest logfmt and json parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonAndLogfmtSeries])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'ADD_JSON_PARSER' }),
          expect.objectContaining({ type: 'ADD_LOGFMT_PARSER' }),
        ])
      );
    });

    it('does not suggest parser when parser in query', () => {
      expect(getQueryHints('{job="grafana"} | json', [jsonAndLogfmtSeries])).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'ADD_JSON_PARSER' }),
          expect.objectContaining({ type: 'ADD_LOGFMT_PARSER' }),
        ])
      );
    });
  });

  describe('when series with json and packed logs', () => {
    const jsonAndPackSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: ['{"_entry": "bar", "bar": "baz"}'],
        },
      ],
    };

    it('suggest unpack parser when no parser in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonAndPackSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_UNPACK_PARSER' })])
      );
    });

    it('does not suggest json parser', () => {
      expect(getQueryHints('{job="grafana"', [jsonAndPackSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_JSON_PARSER' })])
      );
    });

    it('does not suggest unpack parser when unpack in query', () => {
      expect(getQueryHints('{job="grafana"} | unpack', [jsonAndPackSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_UNPACK_PARSER' })])
      );
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
            values: ['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [labelVariable, { job: 'baz', foo: 'bar' }],
          },
        ],
      };
    };
    it('suggest level renaming when no level label', () => {
      expect(getQueryHints('{job="grafana"', [createSeriesWithLabel('lvl')])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LEVEL_LABEL_FORMAT' })])
      );
    });

    it('does not suggest level renaming if level label', () => {
      expect(getQueryHints('{job="grafana"', [createSeriesWithLabel('level')])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LEVEL_LABEL_FORMAT' })])
      );
    });
  });

  describe('when series with line filter', () => {
    const jsonAndLogfmtSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: ['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"'],
        },
      ],
    };

    it('suggest line filter when no line filter in query', () => {
      expect(getQueryHints('{job="grafana"', [jsonAndLogfmtSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LINE_FILTER' })])
      );
    });

    it('does not suggest line filter when line filter in query', () => {
      expect(getQueryHints('{job="grafana" |= `bar`', [jsonAndLogfmtSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LINE_FILTER' })])
      );
    });
  });

  describe('when series with label filter', () => {
    const jsonAndLogfmtSeries: DataFrame = {
      name: 'logs',
      length: 2,
      fields: [
        {
          name: 'Line',
          type: FieldType.string,
          config: {},
          values: ['{"foo": "bar", "bar": "baz"}', 'foo="bar" bar="baz"'],
        },
      ],
    };

    it('suggest label filter when no label filter in query', () => {
      expect(getQueryHints('{job="grafana" | logfmt', [jsonAndLogfmtSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LABEL_FILTER' })])
      );
    });

    it('does not suggest label filter when label filter in query', () => {
      expect(getQueryHints('{job="grafana" | logfmt | foo = `bar`', [jsonAndLogfmtSeries])).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_LABEL_FILTER' })])
      );
    });
  });

  describe('suggest remove pipeline error', () => {
    const logfmtSeries: DataFrame = {
      name: 'logs',
      length: 1,
      fields: [
        {
          name: 'labels',
          type: FieldType.other,
          config: {},
          values: [{ __error__: 'some error', job: 'a' }],
        },
      ],
    };

    it('suggest remove pipeline error', () => {
      expect(getQueryHints('{job="grafana" | json', [logfmtSeries])).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADD_NO_PIPELINE_ERROR' })])
      );
    });
  });
});

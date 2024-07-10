import { DataFrame, FieldType, QueryHint } from '@grafana/data';
import { getExpandRulesHints, getRecordingRuleIdentifierIdx } from '@grafana/prometheus/src/query_hints';
import { RuleQueryMapping } from '@grafana/prometheus/src/types';

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

describe('getExpandRulesHints', () => {
  it('should return no hint when no rule is present in query', () => {
    const extractedMapping: RuleQueryMapping = {};
    const hints = getExpandRulesHints('metric_5m', extractedMapping);
    const expected: QueryHint[] = [];
    expect(hints).toEqual(expected);
  });

  it('should return expand rule hint, single rules', () => {
    const extractedMapping: RuleQueryMapping = {
      metric_5m: [
        {
          query: 'expanded_metric_query[5m]',
          labels: {},
        },
      ],
      metric_15m: [
        {
          query: 'expanded_metric_query[15m]',
          labels: {},
        },
      ],
    };
    const hints = getExpandRulesHints('metric_5m', extractedMapping);
    const expected = expect.arrayContaining([expect.objectContaining({ type: 'EXPAND_RULES' })]);
    expect(hints).toEqual(expected);
  });

  it('should return no expand rule hint, if the given query does not have a label', () => {
    const extractedMapping: RuleQueryMapping = {
      metric_5m: [
        {
          query: 'expanded_metric_query_111[5m]',
          labels: {
            uuid: '111',
          },
        },
        {
          query: 'expanded_metric_query_222[5m]',
          labels: {
            uuid: '222',
          },
        },
      ],
      metric_15m: [
        {
          query: 'expanded_metric_query[15m]',
          labels: {},
        },
      ],
    };
    const hints = getExpandRulesHints(
      `sum(metric_5m{uuid="5m"} + metric_10m{uuid="10m"}) + metric_66m{uuid="66m"}`,
      extractedMapping
    );
    expect(hints).toEqual([]);
  });

  it('should return expand rule warning hint, if the given query *does* have a label', () => {
    const extractedMapping: RuleQueryMapping = {
      metric_5m: [
        {
          query: 'expanded_metric_query_111[5m]',
          labels: {
            uuid: '111',
          },
        },
        {
          query: 'expanded_metric_query_222[5m]',
          labels: {
            uuid: '222',
          },
        },
      ],
      metric_15m: [
        {
          query: 'expanded_metric_query[15m]',
          labels: {},
        },
      ],
    };
    const query = `metric_5m{uuid="111"}`;
    const hints = getExpandRulesHints('metric_5m{uuid="111"}', extractedMapping);
    expect(hints).toEqual([
      {
        type: 'EXPAND_RULES',
        label: 'Query contains recording rules.',
        fix: {
          label: 'Expand rules',
          action: {
            type: 'EXPAND_RULES',
            query,
            options: { query: 'expanded_metric_query_111[5m]', labels: { uuid: '111' } },
          },
        },
      },
    ]);
  });
});

describe('checkRecordingRuleIdentifier', () => {
  it('should return the matching identifier', () => {
    const mapping: RuleQueryMapping[string] = [
      {
        query: 'expanded_metric_query_111[5m]',
        labels: {
          uuid: '111',
        },
      },
      {
        query: 'expanded_metric_query_222[5m]',
        labels: {
          uuid: '222',
        },
      },
    ];
    const ruleName = `metric_5m`;
    const query = `metric_5m{uuid="111"}`;
    const idx = getRecordingRuleIdentifierIdx(query, ruleName, mapping);
    expect(idx).toEqual(0);
  });

  it('should return the matching identifier for a complex query', () => {
    const mapping: RuleQueryMapping[string] = [
      {
        query: 'expanded_metric_query_111[5m]',
        labels: {
          uuid: '111',
        },
      },
      {
        query: 'expanded_metric_query_222[5m]',
        labels: {
          uuid: '222',
        },
      },
    ];
    const ruleName = `metric_55m`;
    const query = `metric_5m{uuid="111"} + metric_55m{uuid="222"}`;
    const idx = getRecordingRuleIdentifierIdx(query, ruleName, mapping);
    expect(idx).toEqual(1);
  });
});

import { AbstractLabelOperator, AbstractQuery } from '@grafana/data';

import {
  escapeLabelValueInExactSelector,
  escapeLabelValueInRegexSelector,
  expandRecordingRules,
  fixSummariesMetadata,
  parseSelector,
  toPromLikeQuery,
} from './language_utils';

describe('parseSelector()', () => {
  let parsed;

  it('returns a clean selector from an empty selector', () => {
    parsed = parseSelector('{}', 1);
    expect(parsed.selector).toBe('{}');
    expect(parsed.labelKeys).toEqual([]);
  });

  it('returns a clean selector from an unclosed selector', () => {
    const parsed = parseSelector('{foo');
    expect(parsed.selector).toBe('{}');
  });

  it('returns the selector sorted by label key', () => {
    parsed = parseSelector('{foo="bar"}');
    expect(parsed.selector).toBe('{foo="bar"}');
    expect(parsed.labelKeys).toEqual(['foo']);

    parsed = parseSelector('{foo="bar",baz="xx"}');
    expect(parsed.selector).toBe('{baz="xx",foo="bar"}');
  });

  it('returns a clean selector from an incomplete one', () => {
    parsed = parseSelector('{foo}');
    expect(parsed.selector).toBe('{}');

    parsed = parseSelector('{foo="bar",baz}');
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar",baz="}');
    expect(parsed.selector).toBe('{foo="bar"}');

    // Cursor in value area counts as incomplete
    parsed = parseSelector('{foo="bar",baz=""}', 16);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar",baz="4"}', 17);
    expect(parsed.selector).toBe('{foo="bar"}');
  });

  it('throws if not inside a selector', () => {
    expect(() => parseSelector('foo{}', 0)).toThrow();
    expect(() => parseSelector('foo{} + bar{}', 5)).toThrow();
  });

  it('returns the selector nearest to the cursor offset', () => {
    expect(() => parseSelector('{foo="bar"} + {foo="bar"}', 0)).toThrow();

    parsed = parseSelector('{foo="bar"} + {foo="bar"}', 1);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{foo="bar"} + {baz="xx"}', 1);
    expect(parsed.selector).toBe('{foo="bar"}');

    parsed = parseSelector('{baz="xx"} + {foo="bar"}', 16);
    expect(parsed.selector).toBe('{foo="bar"}');
  });

  it('returns a selector with metric if metric is given', () => {
    parsed = parseSelector('bar{foo}', 4);
    expect(parsed.selector).toBe('{__name__="bar"}');

    parsed = parseSelector('baz{foo="bar"}', 13);
    expect(parsed.selector).toBe('{__name__="baz",foo="bar"}');

    parsed = parseSelector('bar:metric:1m{}', 14);
    expect(parsed.selector).toBe('{__name__="bar:metric:1m"}');
  });
});

describe('fixSummariesMetadata', () => {
  const synthetics = {
    ALERTS: {
      type: 'counter',
      help: 'Time series showing pending and firing alerts. The sample value is set to 1 as long as the alert is in the indicated active (pending or firing) state.',
    },
  };
  it('returns only synthetics on empty metadata', () => {
    expect(fixSummariesMetadata({})).toEqual({ ...synthetics });
  });

  it('returns unchanged metadata if no summary is present', () => {
    const metadataRaw = {
      foo: [{ type: 'not_a_summary', help: 'foo help' }],
    };

    const metadata = {
      foo: { type: 'not_a_summary', help: 'foo help' },
    };
    expect(fixSummariesMetadata(metadataRaw)).toEqual({ ...metadata, ...synthetics });
  });

  it('returns metadata with added count and sum for a summary', () => {
    const metadata = {
      foo: [{ type: 'not_a_summary', help: 'foo help' }],
      bar: [{ type: 'summary', help: 'bar help' }],
    };
    const expected = {
      foo: { type: 'not_a_summary', help: 'foo help' },
      bar: { type: 'summary', help: 'bar help' },
      bar_count: { type: 'counter', help: 'Count of events that have been observed for the base metric (bar help)' },
      bar_sum: { type: 'counter', help: 'Total sum of all observed values for the base metric (bar help)' },
    };
    expect(fixSummariesMetadata(metadata)).toEqual({ ...expected, ...synthetics });
  });

  it('returns metadata with added bucket/count/sum for a histogram', () => {
    const metadata = {
      foo: [{ type: 'not_a_histogram', help: 'foo help' }],
      bar: [{ type: 'histogram', help: 'bar help' }],
    };
    const expected = {
      foo: { type: 'not_a_histogram', help: 'foo help' },
      bar: { type: 'histogram', help: 'bar help' },
      bar_bucket: { type: 'counter', help: 'Cumulative counters for the observation buckets (bar help)' },
      bar_count: {
        type: 'counter',
        help: 'Count of events that have been observed for the histogram metric (bar help)',
      },
      bar_sum: { type: 'counter', help: 'Total sum of all observed values for the histogram metric (bar help)' },
    };
    expect(fixSummariesMetadata(metadata)).toEqual({ ...expected, ...synthetics });
  });
});

describe('expandRecordingRules()', () => {
  it('returns query w/o recording rules as is', () => {
    expect(expandRecordingRules('metric', {})).toBe('metric');
    expect(expandRecordingRules('metric + metric', {})).toBe('metric + metric');
    expect(expandRecordingRules('metric{}', {})).toBe('metric{}');
  });

  it('does not modify recording rules name in label values', () => {
    expect(expandRecordingRules('{__name__="metric"} + bar', { metric: 'foo', bar: 'super' })).toBe(
      '{__name__="metric"} + super'
    );
  });

  it('returns query with expanded recording rules', () => {
    expect(expandRecordingRules('metric', { metric: 'foo' })).toBe('foo');
    expect(expandRecordingRules('metric + metric', { metric: 'foo' })).toBe('foo + foo');
    expect(expandRecordingRules('metric{}', { metric: 'foo' })).toBe('foo{}');
    expect(expandRecordingRules('metric[]', { metric: 'foo' })).toBe('foo[]');
    expect(expandRecordingRules('metric + foo', { metric: 'foo', foo: 'bar' })).toBe('foo + bar');
  });

  it('returns query with labels with expanded recording rules', () => {
    expect(
      expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', { metricA: 'fooA', metricB: 'fooB' })
    ).toBe('fooA{label1="value1"} / fooB{label2="value2"}');
    expect(
      expandRecordingRules('metricA{label1="value1",label2="value,2"}', {
        metricA: 'rate(fooA[])',
      })
    ).toBe('rate(fooA{label1="value1", label2="value,2"}[])');
    expect(
      expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', {
        metricA: 'rate(fooA[])',
        metricB: 'rate(fooB[])',
      })
    ).toBe('rate(fooA{label1="value1"}[])/ rate(fooB{label2="value2"}[])');
    expect(
      expandRecordingRules('metricA{label1="value1",label2="value2"} / metricB{label3="value3"}', {
        metricA: 'rate(fooA[])',
        metricB: 'rate(fooB[])',
      })
    ).toBe('rate(fooA{label1="value1", label2="value2"}[])/ rate(fooB{label3="value3"}[])');
  });
});

describe('escapeLabelValueInExactSelector()', () => {
  it('handles newline characters', () => {
    expect(escapeLabelValueInExactSelector('t\nes\nt')).toBe('t\\nes\\nt');
  });

  it('handles backslash characters', () => {
    expect(escapeLabelValueInExactSelector('t\\es\\t')).toBe('t\\\\es\\\\t');
  });

  it('handles double-quote characters', () => {
    expect(escapeLabelValueInExactSelector('t"es"t')).toBe('t\\"es\\"t');
  });

  it('handles all together', () => {
    expect(escapeLabelValueInExactSelector('t\\e"st\nl\nab"e\\l')).toBe('t\\\\e\\"st\\nl\\nab\\"e\\\\l');
  });
});

describe('escapeLabelValueInRegexSelector()', () => {
  it('handles newline characters', () => {
    expect(escapeLabelValueInRegexSelector('t\nes\nt')).toBe('t\\nes\\nt');
  });

  it('handles backslash characters', () => {
    expect(escapeLabelValueInRegexSelector('t\\es\\t')).toBe('t\\\\\\\\es\\\\\\\\t');
  });

  it('handles double-quote characters', () => {
    expect(escapeLabelValueInRegexSelector('t"es"t')).toBe('t\\"es\\"t');
  });

  it('handles regex-meaningful characters', () => {
    expect(escapeLabelValueInRegexSelector('t+es$t')).toBe('t\\\\+es\\\\$t');
  });

  it('handles all together', () => {
    expect(escapeLabelValueInRegexSelector('t\\e"s+t\nl\n$ab"e\\l')).toBe(
      't\\\\\\\\e\\"s\\\\+t\\nl\\n\\\\$ab\\"e\\\\\\\\l'
    );
  });
});

describe('toPromLikeQuery', () => {
  it('export abstract query to PromQL-like query', () => {
    const abstractQuery: AbstractQuery = {
      refId: 'bar',
      labelMatchers: [
        { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
        { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
        { name: 'label3', operator: AbstractLabelOperator.EqualRegEx, value: 'value3' },
        { name: 'label4', operator: AbstractLabelOperator.NotEqualRegEx, value: 'value4' },
      ],
    };

    expect(toPromLikeQuery(abstractQuery)).toMatchObject({
      refId: 'bar',
      expr: '{label1="value1", label2!="value2", label3=~"value3", label4!~"value4"}',
      range: true,
    });
  });
});

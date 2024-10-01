// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_utils.test.ts
import { Moment } from 'moment';

import { AbstractLabelOperator, AbstractQuery, DateTime, dateTime, TimeRange } from '@grafana/data';

import {
  escapeLabelValueInExactSelector,
  escapeLabelValueInRegexSelector,
  expandRecordingRules,
  fixSummariesMetadata,
  getPrometheusTime,
  getRangeSnapInterval,
  parseSelector,
  toPromLikeQuery,
  truncateResult,
} from './language_utils';
import { PrometheusCacheLevel } from './types';

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
      bar_count: {
        type: 'counter',
        help: 'Count of events that have been observed for the base metric (bar help)',
      },
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
    expect(
      expandRecordingRules('{__name__="metric"} + bar', {
        metric: { expandedQuery: 'foo' },
        bar: { expandedQuery: 'super' },
      })
    ).toBe('{__name__="metric"} + super');
  });

  it('returns query with expanded recording rules', () => {
    expect(expandRecordingRules('metric', { metric: { expandedQuery: 'foo' } })).toBe('foo');
    expect(expandRecordingRules('metric + metric', { metric: { expandedQuery: 'foo' } })).toBe('foo + foo');
    expect(expandRecordingRules('metric{}', { metric: { expandedQuery: 'foo' } })).toBe('foo{}');
    expect(expandRecordingRules('metric[]', { metric: { expandedQuery: 'foo' } })).toBe('foo[]');
    expect(
      expandRecordingRules('metric + foo', {
        metric: { expandedQuery: 'foo' },
        foo: { expandedQuery: 'bar' },
      })
    ).toBe('foo + bar');
  });

  it('returns query with labels with expanded recording rules', () => {
    expect(
      expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', {
        metricA: { expandedQuery: 'fooA' },
        metricB: { expandedQuery: 'fooB' },
      })
    ).toBe('fooA{label1="value1"} / fooB{label2="value2"}');
    expect(
      expandRecordingRules('metricA{label1="value1",label2="value,2"}', {
        metricA: { expandedQuery: 'rate(fooA[])' },
      })
    ).toBe('rate(fooA{label1="value1", label2="value,2"}[])');
    expect(
      expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', {
        metricA: { expandedQuery: 'rate(fooA[])' },
        metricB: { expandedQuery: 'rate(fooB[])' },
      })
    ).toBe('rate(fooA{label1="value1"}[]) / rate(fooB{label2="value2"}[])');
    expect(
      expandRecordingRules('metricA{label1="value1",label2="value2"} / metricB{label3="value3"}', {
        metricA: { expandedQuery: 'rate(fooA[])' },
        metricB: { expandedQuery: 'rate(fooB[])' },
      })
    ).toBe('rate(fooA{label1="value1", label2="value2"}[]) / rate(fooB{label3="value3"}[])');
  });

  it('expands the query even it is wrapped with parentheses', () => {
    expect(
      expandRecordingRules('sum (metric{label1="value1"}) by (env)', {
        metric: { expandedQuery: 'foo{labelInside="valueInside"}' },
      })
    ).toBe('sum (foo{labelInside="valueInside", label1="value1"}) by (env)');
  });

  it('expands the query with regex match', () => {
    expect(
      expandRecordingRules('sum (metric{label1=~"/value1/(sa|sb)"}) by (env)', {
        metric: { expandedQuery: 'foo{labelInside="valueInside"}' },
      })
    ).toBe('sum (foo{labelInside="valueInside", label1=~"/value1/(sa|sb)"}) by (env)');
  });

  it('ins:metric:per{pid="val-42", comp="api"}', () => {
    const query = `aaa:111{pid="val-42", comp="api"} + bbb:222{pid="val-42"}`;
    const mapping = {
      'aaa:111': {
        expandedQuery:
          '(max without (mp) (targetMetric{device=~"/dev/(sda1|sdb)"}) / max without (mp) (targetMetric2{device=~"/dev/(sda1|sdb)"}))',
      },
      'bbb:222': { expandedQuery: '(targetMetric2{device=~"/dev/(sda1|sdb)"})' },
    };
    const expected = `(max without (mp) (targetMetric{device=~"/dev/(sda1|sdb)", pid="val-42", comp="api"}) / max without (mp) (targetMetric2{device=~"/dev/(sda1|sdb)", pid="val-42", comp="api"})) + (targetMetric2{device=~"/dev/(sda1|sdb)", pid="val-42"})`;
    const result = expandRecordingRules(query, mapping);
    expect(result).toBe(expected);
  });

  it('when there is an identifier, identifier must be removed from expanded query', () => {
    const query = `ins:metric:per{uuid="111", comp="api"}`;
    const mapping = {
      'ins:metric:per': {
        expandedQuery: 'targetMetric{device="some_device"}',
        identifier: 'uuid',
        identifierValue: '111',
      },
    };
    const expected = `targetMetric{device="some_device", comp="api"}`;
    const result = expandRecordingRules(query, mapping);
    expect(result).toBe(expected);
  });

  it('when there is an identifier, identifier must be removed from complex expanded query', () => {
    const query = `instance_path:requests:rate5m{uuid="111", four="tops"} + instance_path:requests:rate15m{second="album", uuid="222"}`;
    const mapping = {
      'instance_path:requests:rate5m': {
        expandedQuery: `rate(prometheus_http_requests_total{job="prometheus"}`,
        identifier: 'uuid',
        identifierValue: '111',
      },
      'instance_path:requests:rate15m': {
        expandedQuery: `prom_http_requests_sum{job="prometheus"}`,
        identifier: 'uuid',
        identifierValue: '222',
      },
    };
    const expected = `rate(prometheus_http_requests_total{job="prometheus", four="tops"} + prom_http_requests_sum{job="prometheus", second="album"}`;
    const result = expandRecordingRules(query, mapping);
    expect(result).toBe(expected);
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

describe('getRangeSnapInterval', () => {
  it('will not change input if set to no cache', () => {
    const intervalSeconds = 10 * 60; // 10 minutes
    const now = new Date().valueOf();

    const expectedFrom = dateTime(now - intervalSeconds * 1000);
    const expectedTo = dateTime(now);

    const range: TimeRange = {
      from: expectedFrom,
      to: expectedTo,
    } as TimeRange;

    expect(getRangeSnapInterval(PrometheusCacheLevel.None, range)).toEqual({
      start: getPrometheusTime(expectedFrom, false).toString(),
      end: getPrometheusTime(expectedTo, true).toString(),
    });
  });

  it('will snap range to closest minute', () => {
    const queryDurationMinutes = 10;
    const intervalSeconds = queryDurationMinutes * 60; // 10 minutes
    const now = 1680901009826;
    const nowPlusOneMinute = now + 1000 * 60;
    const nowPlusTwoMinute = now + 1000 * 60 * 2;

    const nowTime = dateTime(now) as Moment;

    const expectedFrom = nowTime.clone().startOf('minute').subtract(queryDurationMinutes, 'minute');
    const expectedTo = nowTime.clone().startOf('minute').add(1, 'minute');

    const range: TimeRange = {
      from: dateTime(now - intervalSeconds * 1000),
      to: dateTime(now),
    } as TimeRange;

    const range2: TimeRange = {
      from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusOneMinute),
      raw: {
        from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusOneMinute),
      },
    };
    const range3: TimeRange = {
      from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusTwoMinute),
      raw: {
        from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusTwoMinute),
      },
    };

    const first = getRangeSnapInterval(PrometheusCacheLevel.Low, range);
    const second = getRangeSnapInterval(PrometheusCacheLevel.Low, range2);
    const third = getRangeSnapInterval(PrometheusCacheLevel.Low, range3);

    expect(first).toEqual({
      start: getPrometheusTime(expectedFrom as DateTime, false).toString(10),
      end: getPrometheusTime(expectedTo as DateTime, false).toString(10),
    });

    expect(second).toEqual({
      start: getPrometheusTime(expectedFrom.clone().add(1, 'minute') as DateTime, false).toString(10),
      end: getPrometheusTime(expectedTo.clone().add(1, 'minute') as DateTime, false).toString(10),
    });

    expect(third).toEqual({
      start: getPrometheusTime(expectedFrom.clone().add(2, 'minute') as DateTime, false).toString(10),
      end: getPrometheusTime(expectedTo.clone().add(2, 'minute') as DateTime, false).toString(10),
    });
  });

  it('will snap range to closest 10 minute', () => {
    const queryDurationMinutes = 60;
    const intervalSeconds = queryDurationMinutes * 60; // 10 minutes
    const now = 1680901009826;
    const nowPlusOneMinute = now + 1000 * 60;
    const nowPlusTwoMinute = now + 1000 * 60 * 2;

    const nowTime = dateTime(now) as Moment;
    const nowTimePlusOne = dateTime(nowPlusOneMinute) as Moment;
    const nowTimePlusTwo = dateTime(nowPlusTwoMinute) as Moment;

    const calculateClosest10 = (date: Moment): Moment => {
      const numberOfMinutes = Math.floor(date.minutes() / 10) * 10;
      const numberOfHours = numberOfMinutes < 60 ? date.hours() : date.hours() + 1;
      return date
        .clone()
        .minutes(numberOfMinutes % 60)
        .hours(numberOfHours);
    };

    const expectedFromFirst = calculateClosest10(
      nowTime.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToFirst = calculateClosest10(nowTime.clone().startOf('minute').add(1, 'minute'));

    const expectedFromSecond = calculateClosest10(
      nowTimePlusOne.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToSecond = calculateClosest10(nowTimePlusOne.clone().startOf('minute').add(1, 'minute'));

    const expectedFromThird = calculateClosest10(
      nowTimePlusTwo.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToThird = calculateClosest10(nowTimePlusTwo.clone().startOf('minute').add(1, 'minute'));

    const range: TimeRange = {
      from: dateTime(now - intervalSeconds * 1000),
      to: dateTime(now),
    } as TimeRange;

    const range2: TimeRange = {
      from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusOneMinute),
      raw: {
        from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusOneMinute),
      },
    };
    const range3: TimeRange = {
      from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusTwoMinute),
      raw: {
        from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusTwoMinute),
      },
    };

    const first = getRangeSnapInterval(PrometheusCacheLevel.Medium, range);
    const second = getRangeSnapInterval(PrometheusCacheLevel.Medium, range2);
    const third = getRangeSnapInterval(PrometheusCacheLevel.Medium, range3);

    expect(first).toEqual({
      start: getPrometheusTime(expectedFromFirst as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToFirst as DateTime, false).toString(10),
    });

    expect(second).toEqual({
      start: getPrometheusTime(expectedFromSecond.clone() as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToSecond.clone() as DateTime, false).toString(10),
    });

    expect(third).toEqual({
      start: getPrometheusTime(expectedFromThird.clone() as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToThird.clone() as DateTime, false).toString(10),
    });
  });

  it('will snap range to closest 60 minute', () => {
    const queryDurationMinutes = 120;
    const intervalSeconds = queryDurationMinutes * 60;
    const now = 1680901009826;
    const nowPlusOneMinute = now + 1000 * 60;
    const nowPlusTwoMinute = now + 1000 * 60 * 2;

    const nowTime = dateTime(now) as Moment;
    const nowTimePlusOne = dateTime(nowPlusOneMinute) as Moment;
    const nowTimePlusTwo = dateTime(nowPlusTwoMinute) as Moment;

    const calculateClosest60 = (date: Moment): Moment => {
      const numberOfMinutes = Math.floor(date.minutes() / 60) * 60;
      const numberOfHours = numberOfMinutes < 60 ? date.hours() : date.hours() + 1;
      return date
        .clone()
        .minutes(numberOfMinutes % 60)
        .hours(numberOfHours);
    };

    const expectedFromFirst = calculateClosest60(
      nowTime.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToFirst = calculateClosest60(nowTime.clone().startOf('minute').add(1, 'minute'));

    const expectedFromSecond = calculateClosest60(
      nowTimePlusOne.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToSecond = calculateClosest60(nowTimePlusOne.clone().startOf('minute').add(1, 'minute'));

    const expectedFromThird = calculateClosest60(
      nowTimePlusTwo.clone().startOf('minute').subtract(queryDurationMinutes, 'minute')
    );
    const expectedToThird = calculateClosest60(nowTimePlusTwo.clone().startOf('minute').add(1, 'minute'));

    const range: TimeRange = {
      from: dateTime(now - intervalSeconds * 1000),
      to: dateTime(now),
    } as TimeRange;

    const range2: TimeRange = {
      from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusOneMinute),
      raw: {
        from: dateTime(nowPlusOneMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusOneMinute),
      },
    };
    const range3: TimeRange = {
      from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
      to: dateTime(nowPlusTwoMinute),
      raw: {
        from: dateTime(nowPlusTwoMinute - intervalSeconds * 1000),
        to: dateTime(nowPlusTwoMinute),
      },
    };

    const first = getRangeSnapInterval(PrometheusCacheLevel.High, range);
    const second = getRangeSnapInterval(PrometheusCacheLevel.High, range2);
    const third = getRangeSnapInterval(PrometheusCacheLevel.High, range3);

    expect(first).toEqual({
      start: getPrometheusTime(expectedFromFirst as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToFirst as DateTime, false).toString(10),
    });

    expect(second).toEqual({
      start: getPrometheusTime(expectedFromSecond.clone() as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToSecond.clone() as DateTime, false).toString(10),
    });

    expect(third).toEqual({
      start: getPrometheusTime(expectedFromThird.clone() as DateTime, false).toString(10),
      end: getPrometheusTime(expectedToThird.clone() as DateTime, false).toString(10),
    });
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

describe('truncateResult', () => {
  it('truncates array longer then 1k from the start of array', () => {
    // creates an array of 1k + 1 elements with values from 0 to 1k
    const array = Array.from(Array(1001).keys());
    expect(array[1000]).toBe(1000);
    truncateResult(array);
    expect(array.length).toBe(1000);
    expect(array[0]).toBe(0);
    expect(array[999]).toBe(999);
  });
});

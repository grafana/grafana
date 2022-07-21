import { addLabelToQuery, addNoPipelineErrorToQuery, addParserToQuery } from './addToQuery';

describe('addLabelToQuery()', () => {
  it('should add label to simple query', () => {
    expect(() => {
      addLabelToQuery('foo', '', '=', '');
    }).toThrow();
    expect(addLabelToQuery('{}', 'bar', '=', 'baz')).toBe('{bar="baz"}');
    expect(addLabelToQuery('{x="yy"}', 'bar', '=', 'baz')).toBe('{x="yy", bar="baz"}');
  });

  it('should add custom operator', () => {
    expect(addLabelToQuery('{}', 'bar', '!=', 'baz')).toBe('{bar!="baz"}');
    expect(addLabelToQuery('{x="yy"}', 'bar', '!=', 'baz')).toBe('{x="yy", bar!="baz"}');
  });

  it('should not modify ranges', () => {
    expect(addLabelToQuery('rate({}[1m])', 'foo', '=', 'bar')).toBe('rate({foo="bar"}[1m])');
  });

  it('should detect in-order function use', () => {
    expect(addLabelToQuery('sum by (host) (rate({} [1m]))', 'bar', '=', 'baz')).toBe(
      'sum by (host) (rate({bar="baz"} [1m]))'
    );
  });

  it('should handle selectors with punctuation', () => {
    expect(addLabelToQuery('{instance="my-host.com:9100"}', 'bar', '=', 'baz')).toBe(
      '{instance="my-host.com:9100", bar="baz"}'
    );
    expect(addLabelToQuery('{list="a,b,c"}', 'bar', '=', 'baz')).toBe('{list="a,b,c", bar="baz"}');
  });

  it('should work on arithmetical expressions', () => {
    expect(addLabelToQuery('{} + {}', 'bar', '=', 'baz')).toBe('{bar="baz"} + {bar="baz"}');
    expect(addLabelToQuery('avg(rate({x="y"} [$__interval]))+ sum(rate({}[5m]))', 'bar', '=', 'baz')).toBe(
      'avg(rate({x="y", bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'
    );
    expect(addLabelToQuery('{x="yy"} * {y="zz",a="bb"} * {}', 'bar', '=', 'baz')).toBe(
      '{x="yy", bar="baz"} * {y="zz", a="bb", bar="baz"} * {bar="baz"}'
    );
  });

  it('should not add duplicate labels to a query', () => {
    expect(addLabelToQuery(addLabelToQuery('{x="yy"}', 'bar', '!=', 'baz'), 'bar', '!=', 'baz')).toBe(
      '{x="yy", bar!="baz"}'
    );
    expect(addLabelToQuery(addLabelToQuery('rate({}[1m])', 'foo', '=', 'bar'), 'foo', '=', 'bar')).toBe(
      'rate({foo="bar"}[1m])'
    );
    expect(addLabelToQuery(addLabelToQuery('{list="a,b,c"}', 'bar', '=', 'baz'), 'bar', '=', 'baz')).toBe(
      '{list="a,b,c", bar="baz"}'
    );
    expect(
      addLabelToQuery(
        addLabelToQuery('avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))', 'bar', '=', 'baz'),
        'bar',
        '=',
        'baz'
      )
    ).toBe('avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))');
  });

  it('should not remove filters', () => {
    expect(addLabelToQuery('{x="y"} |="yy"', 'bar', '=', 'baz')).toBe('{x="y", bar="baz"} |="yy"');
    expect(addLabelToQuery('{x="y"} |="yy" !~"xx"', 'bar', '=', 'baz')).toBe('{x="y", bar="baz"} |="yy" !~"xx"');
  });

  it('should add label to query properly with Loki datasource', () => {
    expect(addLabelToQuery('{job="grafana"} |= "foo-bar"', 'filename', '=', 'test.txt')).toBe(
      '{job="grafana", filename="test.txt"} |= "foo-bar"'
    );
  });

  it('should add labels to metrics with logical operators', () => {
    expect(addLabelToQuery('{x="y"} or {}', 'bar', '=', 'baz')).toBe('{x="y", bar="baz"} or {bar="baz"}');
    expect(addLabelToQuery('{x="y"} and {}', 'bar', '=', 'baz')).toBe('{x="y", bar="baz"} and {bar="baz"}');
  });

  it('should not add ad-hoc filter to template variables', () => {
    expect(addLabelToQuery('sum(rate({job="foo"}[2m])) by (value $variable)', 'bar', '=', 'baz')).toBe(
      'sum(rate({job="foo", bar="baz"}[2m])) by (value $variable)'
    );
  });

  it('should not add ad-hoc filter to range', () => {
    expect(addLabelToQuery('avg(rate(({job="foo"} > 0)[3h:])) by (label)', 'bar', '=', 'baz')).toBe(
      'avg(rate(({job="foo", bar="baz"} > 0)[3h:])) by (label)'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(
      addLabelToQuery(
        'max by (id, name, type) ({type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) (rate({} [5m])) * 1000',
        'bar',
        '=',
        'baz'
      )
    ).toBe(
      'max by (id, name, type) ({type=~"foo|bar|baz-test", bar="baz"}) * on(id) group_right(id, type, name) sum by (id) (rate({bar="baz"} [5m])) * 1000'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(addLabelToQuery('rate({x="y"}[${__range_s}s])', 'bar', '=', 'baz')).toBe(
      'rate({x="y", bar="baz"}[${__range_s}s])'
    );
  });
  it('should not add ad-hoc filter to labels to math operations', () => {
    expect(addLabelToQuery('count({job!="foo"} < (5*1024*1024*1024) or vector(0)) - 1', 'bar', '=', 'baz')).toBe(
      'count({job!="foo", bar="baz"} < (5*1024*1024*1024) or vector(0)) - 1'
    );
  });

  describe('should add label as label filter is query with parser', () => {
    it('should add label filter after parser', () => {
      expect(addLabelToQuery('{foo="bar"} | logfmt', 'bar', '=', 'baz')).toBe('{foo="bar"} | logfmt | bar=`baz`');
    });
    it('should add label filter after last parser when multiple parsers', () => {
      expect(addLabelToQuery('{foo="bar"} | logfmt | json', 'bar', '=', 'baz')).toBe(
        '{foo="bar"} | logfmt | json | bar=`baz`'
      );
    });
    it('should add label filter after last label filter when multiple label filters', () => {
      expect(addLabelToQuery('{foo="bar"} | logfmt | x="y"', 'bar', '=', 'baz')).toBe(
        '{foo="bar"} | logfmt | x="y" | bar=`baz`'
      );
    });
    it('should add label filter in metric query', () => {
      expect(addLabelToQuery('rate({foo="bar"} | logfmt [5m])', 'bar', '=', 'baz')).toBe(
        'rate({foo="bar"} | logfmt | bar=`baz` [5m])'
      );
    });
    it('should add label filter in complex metric query', () => {
      expect(
        addLabelToQuery(
          'sum by(host) (rate({foo="bar"} | logfmt | x="y" | line_format "{{.status}}" [5m]))',
          'bar',
          '=',
          'baz'
        )
      ).toBe('sum by(host) (rate({foo="bar"} | logfmt | x="y" | bar=`baz` | line_format "{{.status}}" [5m]))');
    });
    it('should not add adhoc filter to line_format expressions', () => {
      expect(addLabelToQuery('{foo="bar"} | logfmt | line_format "{{.status}}"', 'bar', '=', 'baz')).toBe(
        '{foo="bar"} | logfmt | bar=`baz` | line_format "{{.status}}"'
      );
    });

    it('should not add adhoc filter to line_format expressions', () => {
      expect(addLabelToQuery('{foo="bar"} | logfmt | line_format "{{status}}"', 'bar', '=', 'baz')).toBe(
        '{foo="bar"} | logfmt | bar=`baz` | line_format "{{status}}"'
      );
    });
  });
});

describe('addParserToQuery', () => {
  describe('when query had line filter', () => {
    it('should add parser after line filter', () => {
      expect(addParserToQuery('{job="grafana"} |= "error"', 'logfmt')).toBe('{job="grafana"} |= "error" | logfmt');
    });

    it('should add parser after multiple line filters', () => {
      expect(addParserToQuery('{job="grafana"} |= "error" |= "info" |= "debug"', 'logfmt')).toBe(
        '{job="grafana"} |= "error" |= "info" |= "debug" | logfmt'
      );
    });
  });

  describe('when query has no line filters', () => {
    it('should add parser after log stream selector in logs query', () => {
      expect(addParserToQuery('{job="grafana"}', 'logfmt')).toBe('{job="grafana"} | logfmt');
    });

    it('should add parser after log stream selector in metric query', () => {
      expect(addParserToQuery('rate({job="grafana"} [5m])', 'logfmt')).toBe('rate({job="grafana"} | logfmt [5m])');
    });
  });
});

describe('addNoPipelineErrorToQuery', () => {
  it('should add error filtering after logfmt parser', () => {
    expect(addNoPipelineErrorToQuery('{job="grafana"} | logfmt')).toBe('{job="grafana"} | logfmt | __error__=``');
  });

  it('should add error filtering after json parser with expressions', () => {
    expect(addNoPipelineErrorToQuery('{job="grafana"} | json foo="bar", bar="baz"')).toBe(
      '{job="grafana"} | json foo="bar", bar="baz" | __error__=``'
    );
  });

  it('should not add error filtering if no parser', () => {
    expect(addNoPipelineErrorToQuery('{job="grafana"} |="no parser"')).toBe('{job="grafana"} |="no parser"');
  });
});

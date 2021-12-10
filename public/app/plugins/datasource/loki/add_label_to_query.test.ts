import { addLabelToQuery, addLabelToSelector } from './add_label_to_query';

describe('addLabelToQuery()', () => {
  it('should add label to simple query', () => {
    expect(() => {
      addLabelToQuery('foo', '', '');
    }).toThrow();
    expect(addLabelToQuery('{}', 'bar', 'baz')).toBe('{bar="baz"}');
    expect(addLabelToQuery('{x="yy"}', 'bar', 'baz')).toBe('{bar="baz",x="yy"}');
  });

  it('should add custom operator', () => {
    expect(addLabelToQuery('{}', 'bar', 'baz', '!=')).toBe('{bar!="baz"}');
    expect(addLabelToQuery('{x="yy"}', 'bar', 'baz', '!=')).toBe('{bar!="baz",x="yy"}');
  });

  it('should not modify ranges', () => {
    expect(addLabelToQuery('rate({}[1m])', 'foo', 'bar')).toBe('rate({foo="bar"}[1m])');
  });

  it('should detect in-order function use', () => {
    expect(addLabelToQuery('sum by (xx) ({})', 'bar', 'baz')).toBe('sum by (xx) ({bar="baz"})');
  });

  it('should convert number Infinity to +Inf', () => {
    expect(addLabelToQuery('sum(rate({}[5m])) by (le)', 'le', Infinity)).toBe('sum(rate({le="+Inf"}[5m])) by (le)');
  });

  it('should handle selectors with punctuation', () => {
    expect(addLabelToQuery('{instance="my-host.com:9100"}', 'bar', 'baz')).toBe(
      '{bar="baz",instance="my-host.com:9100"}'
    );
    expect(addLabelToQuery('{list="a,b,c"}', 'bar', 'baz')).toBe('{bar="baz",list="a,b,c"}');
  });

  it('should work on arithmetical expressions', () => {
    expect(addLabelToQuery('{} + {}', 'bar', 'baz')).toBe('{bar="baz"} + {bar="baz"}');
    expect(addLabelToQuery('avg({}) + sum({})', 'bar', 'baz')).toBe('avg({bar="baz"}) + sum({bar="baz"})');
    expect(addLabelToQuery('{x="yy"} * {y="zz",a="bb"} * {}', 'bar', 'baz')).toBe(
      '{bar="baz",x="yy"} * {a="bb",bar="baz",y="zz"} * {bar="baz"}'
    );
  });

  it('should not add duplicate labels to a query', () => {
    expect(addLabelToQuery(addLabelToQuery('{x="yy"}', 'bar', 'baz', '!='), 'bar', 'baz', '!=')).toBe(
      '{bar!="baz",x="yy"}'
    );
    expect(addLabelToQuery(addLabelToQuery('rate({}[1m])', 'foo', 'bar'), 'foo', 'bar')).toBe('rate({foo="bar"}[1m])');
    expect(addLabelToQuery(addLabelToQuery('{list="a,b,c"}', 'bar', 'baz'), 'bar', 'baz')).toBe(
      '{bar="baz",list="a,b,c"}'
    );
    expect(addLabelToQuery(addLabelToQuery('avg({}) + sum({})', 'bar', 'baz'), 'bar', 'baz')).toBe(
      'avg({bar="baz"}) + sum({bar="baz"})'
    );
  });

  it('should not remove filters', () => {
    expect(addLabelToQuery('{x="y"} |="yy"', 'bar', 'baz')).toBe('{bar="baz",x="y"} |="yy"');
    expect(addLabelToQuery('{x="y"} |="yy" !~"xx"', 'bar', 'baz')).toBe('{bar="baz",x="y"} |="yy" !~"xx"');
  });

  it('should add label to query properly with Loki datasource', () => {
    expect(addLabelToQuery('{job="grafana"} |= "foo-bar"', 'filename', 'test.txt', undefined, true)).toBe(
      '{filename="test.txt",job="grafana"} |= "foo-bar"'
    );
  });

  it('should add labels to metrics with logical operators', () => {
    expect(addLabelToQuery('{} or {}', 'bar', 'baz')).toBe('{bar="baz"} or {bar="baz"}');
    expect(addLabelToQuery('{} and {}', 'bar', 'baz')).toBe('{bar="baz"} and {bar="baz"}');
  });

  it('should not add ad-hoc filter to template variables', () => {
    expect(addLabelToQuery('sum(rate({job="foo"}[2m])) by (value $variable)', 'bar', 'baz')).toBe(
      'sum(rate({bar="baz",job="foo"}[2m])) by (value $variable)'
    );
  });

  it('should not add ad-hoc filter to range', () => {
    expect(addLabelToQuery('avg(rate(({job="foo"} > 0)[3h:])) by (label)', 'bar', 'baz')).toBe(
      'avg(rate(({bar="baz",job="foo"} > 0)[3h:])) by (label)'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(
      addLabelToQuery(
        'max by (id, name, type) ({type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) ({}) * 1000',
        'bar',
        'baz'
      )
    ).toBe(
      'max by (id, name, type) ({bar="baz",type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) ({bar="baz"}) * 1000'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(addLabelToQuery('rate({}[${__range_s}s])', 'bar', 'baz')).toBe('rate({bar="baz"}[${__range_s}s])');
  });
  it('should not add ad-hoc filter to labels to math operations', () => {
    expect(addLabelToQuery('count({job!="foo"} < (5*1024*1024*1024) or vector(0)) - 1', 'bar', 'baz')).toBe(
      'count({bar="baz",job!="foo"} < (5*1024*1024*1024) or vector(0)) - 1'
    );
  });
  it('should not add adhoc filter to line_format expressions', () => {
    expect(addLabelToQuery('{foo="bar"} | logfmt | line_format {{.status}}', 'bar', 'baz')).toBe(
      '{bar="baz",foo="bar"} | logfmt | line_format {{.status}}'
    );
  });
});

describe('addLabelToSelector()', () => {
  test('should add a label to an empty selector', () => {
    expect(addLabelToSelector('{}', 'foo', 'bar')).toBe('{foo="bar"}');
    expect(addLabelToSelector('', 'foo', 'bar')).toBe('{foo="bar"}');
  });
  test('should add a label to a selector', () => {
    expect(addLabelToSelector('{foo="bar"}', 'baz', '42')).toBe('{baz="42",foo="bar"}');
  });
  test('should add a label to a selector with custom operator', () => {
    expect(addLabelToSelector('{}', 'baz', '42', '!=')).toBe('{baz!="42"}');
  });
});

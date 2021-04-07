import { addLabelToQuery, addLabelToSelector } from './add_label_to_query';

describe('addLabelToQuery()', () => {
  it('should add label to simple query', () => {
    expect(() => {
      addLabelToQuery('foo', '', '');
    }).toThrow();
    expect(addLabelToQuery('foo', 'bar', 'baz')).toBe('foo{bar="baz"}');
    expect(addLabelToQuery('foo{}', 'bar', 'baz')).toBe('foo{bar="baz"}');
    expect(addLabelToQuery('foo{x="yy"}', 'bar', 'baz')).toBe('foo{bar="baz",x="yy"}');
    expect(addLabelToQuery('metric > 0.001', 'foo', 'bar')).toBe('metric{foo="bar"} > 0.001');
  });

  it('should add custom operator', () => {
    expect(addLabelToQuery('foo{}', 'bar', 'baz', '!=')).toBe('foo{bar!="baz"}');
    expect(addLabelToQuery('foo{x="yy"}', 'bar', 'baz', '!=')).toBe('foo{bar!="baz",x="yy"}');
  });

  it('should not modify ranges', () => {
    expect(addLabelToQuery('rate(metric[1m])', 'foo', 'bar')).toBe('rate(metric{foo="bar"}[1m])');
  });

  it('should detect in-order function use', () => {
    expect(addLabelToQuery('sum by (xx) (foo)', 'bar', 'baz')).toBe('sum by (xx) (foo{bar="baz"})');
  });

  it('should convert number Infinity to +Inf', () => {
    expect(
      addLabelToQuery('sum(rate(prometheus_tsdb_compaction_chunk_size_bytes_bucket[5m])) by (le)', 'le', Infinity)
    ).toBe('sum(rate(prometheus_tsdb_compaction_chunk_size_bytes_bucket{le="+Inf"}[5m])) by (le)');
  });

  it('should handle selectors with punctuation', () => {
    expect(addLabelToQuery('foo{instance="my-host.com:9100"}', 'bar', 'baz')).toBe(
      'foo{bar="baz",instance="my-host.com:9100"}'
    );
    expect(addLabelToQuery('foo:metric:rate1m', 'bar', 'baz')).toBe('foo:metric:rate1m{bar="baz"}');
    expect(addLabelToQuery('avg(foo:metric:rate1m{a="b"})', 'bar', 'baz')).toBe(
      'avg(foo:metric:rate1m{a="b",bar="baz"})'
    );
    expect(addLabelToQuery('foo{list="a,b,c"}', 'bar', 'baz')).toBe('foo{bar="baz",list="a,b,c"}');
  });

  it('should work on arithmetical expressions', () => {
    expect(addLabelToQuery('foo + foo', 'bar', 'baz')).toBe('foo{bar="baz"} + foo{bar="baz"}');
    expect(addLabelToQuery('foo{x="yy"} + metric', 'bar', 'baz')).toBe('foo{bar="baz",x="yy"} + metric{bar="baz"}');
    expect(addLabelToQuery('avg(foo) + sum(xx_yy)', 'bar', 'baz')).toBe('avg(foo{bar="baz"}) + sum(xx_yy{bar="baz"})');
    expect(addLabelToQuery('foo{x="yy"} * metric{y="zz",a="bb"} * metric2', 'bar', 'baz')).toBe(
      'foo{bar="baz",x="yy"} * metric{a="bb",bar="baz",y="zz"} * metric2{bar="baz"}'
    );
  });

  it('should not add duplicate labels to a query', () => {
    expect(addLabelToQuery(addLabelToQuery('foo{x="yy"}', 'bar', 'baz', '!='), 'bar', 'baz', '!=')).toBe(
      'foo{bar!="baz",x="yy"}'
    );
    expect(addLabelToQuery(addLabelToQuery('rate(metric[1m])', 'foo', 'bar'), 'foo', 'bar')).toBe(
      'rate(metric{foo="bar"}[1m])'
    );
    expect(addLabelToQuery(addLabelToQuery('foo{list="a,b,c"}', 'bar', 'baz'), 'bar', 'baz')).toBe(
      'foo{bar="baz",list="a,b,c"}'
    );
    expect(addLabelToQuery(addLabelToQuery('avg(foo) + sum(xx_yy)', 'bar', 'baz'), 'bar', 'baz')).toBe(
      'avg(foo{bar="baz"}) + sum(xx_yy{bar="baz"})'
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
    expect(addLabelToQuery('foo_info or bar_info', 'bar', 'baz')).toBe('foo_info{bar="baz"} or bar_info{bar="baz"}');
    expect(addLabelToQuery('foo_info and bar_info', 'bar', 'baz')).toBe('foo_info{bar="baz"} and bar_info{bar="baz"}');
  });

  it('should not add ad-hoc filter to template variables', () => {
    expect(addLabelToQuery('sum(rate({job="foo"}[2m])) by (value $variable)', 'bar', 'baz')).toBe(
      'sum(rate({bar="baz",job="foo"}[2m])) by (value $variable)'
    );
  });

  it('should not add ad-hoc filter to range', () => {
    expect(addLabelToQuery('avg(rate((my_metric{job="foo"} > 0)[3h:])) by (label)', 'bar', 'baz')).toBe(
      'avg(rate((my_metric{bar="baz",job="foo"} > 0)[3h:])) by (label)'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(
      addLabelToQuery(
        'max by (id, name, type) (my_metric{type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) (my_metric) * 1000',
        'bar',
        'baz'
      )
    ).toBe(
      'max by (id, name, type) (my_metric{bar="baz",type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) (my_metric{bar="baz"}) * 1000'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(addLabelToQuery('rate(my_metric[${__range_s}s])', 'bar', 'baz')).toBe(
      'rate(my_metric{bar="baz"}[${__range_s}s])'
    );
  });
  it('should not add ad-hoc filter to labels to math operations', () => {
    expect(addLabelToQuery('count(my_metric{job!="foo"} < (5*1024*1024*1024) or vector(0)) - 1', 'bar', 'baz')).toBe(
      'count(my_metric{bar="baz",job!="foo"} < (5*1024*1024*1024) or vector(0)) - 1'
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

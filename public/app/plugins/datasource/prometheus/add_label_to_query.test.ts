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
    expect(addLabelToQuery('go_info or grafana_info', 'bar', 'baz')).toBe(
      'go_info{bar="baz"} or grafana_info{bar="baz"}'
    );
    expect(addLabelToQuery('go_info and grafana_info', 'bar', 'baz')).toBe(
      'go_info{bar="baz"} and grafana_info{bar="baz"}'
    );
  });

  it('should not add ad-hoc filter to template variables', () => {
    expect(addLabelToQuery('sum(rate({job="grafana"}[2m])) by (valueName $variable)', 'bar', 'baz')).toBe(
      'sum(rate({bar="baz",job="grafana"}[2m])) by (valueName $variable)'
    );
  });

  it('should not add ad-hoc filter to range', () => {
    expect(addLabelToQuery('avg(rate((my_metric{instance="foo"} > 0)[3h:])) by (device)', 'bar', 'baz')).toBe(
      'avg(rate((my_metric{bar="baz",instance="foo"} > 0)[3h:])) by (device)'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(
      addLabelToQuery(
        'max by (org_id, org_name, id, name, type) (grafanacloud_instance_info{type=~"prometheus|graphite|graphite-shared"}) * on(id) group_right(org_id, org_name, type, name) sum by (id) (grafanacloud_instance_created_date) * 1000',
        'bar',
        'baz'
      )
    ).toBe(
      'max by (org_id, org_name, id, name, type) (grafanacloud_instance_info{bar="baz",type=~"prometheus|graphite|graphite-shared"}) * on(id) group_right(org_id, org_name, type, name) sum by (id) (grafanacloud_instance_created_date{bar="baz"}) * 1000'
    );
  });
  it('should not add ad-hoc filter to labels in label list provided with the group modifier', () => {
    expect(addLabelToQuery('rate(http_server_requests_seconds_count[${__range_s}s])', 'bar', 'baz')).toBe(
      'rate(http_server_requests_seconds_count{bar="baz"}[${__range_s}s])'
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

import { addLabelToQuery, addLabelToSelector, keepSelectorFilters } from './add_label_to_query';

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

describe('keepSelectorFilters()', () => {
  test('should return empty string if no filter is in selector', () => {
    expect(keepSelectorFilters('{foo="bar"}')).toBe('');
  });
  test('should return a filter if filter is in selector', () => {
    expect(keepSelectorFilters('{foo="bar"} |="baz"')).toBe('|="baz"');
  });
  test('should return multiple filters if multiple filters are in selector', () => {
    expect(keepSelectorFilters('{foo!="bar"} |="baz" |~"yy" !~"xx"')).toBe('|="baz" |~"yy" !~"xx"');
  });
});

import {
  addLabelFormatToQuery,
  addLabelToQuery,
  addNoPipelineErrorToQuery,
  addParserToQuery,
  removeCommentsFromQuery,
} from './modifyQuery';

describe('addLabelToQuery()', () => {
  it.each`
    query                                                                                                                             | description                                                            | label    | operator | value          | expectedResult
    ${'{x="y"}'}                                                                                                                      | ${'no label and value'}                                                | ${''}    | ${'='}   | ${''}          | ${''}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query'}                                                      | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="yy", bar="baz"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query'}                                                      | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="yy", bar="baz"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'custom operator'}                                                   | ${'bar'} | ${'!='}  | ${'baz'}       | ${'{x="yy", bar!="baz"}'}
    ${'rate({}[1m])'}                                                                                                                 | ${'do not modify ranges'}                                              | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({bar="baz"}[1m])'}
    ${'sum by (host) (rate({} [1m]))'}                                                                                                | ${'detect in-order function use'}                                      | ${'bar'} | ${'='}   | ${'baz'}       | ${'sum by (host) (rate({bar="baz"}[1m]))'}
    ${'{instance="my-host.com:9100"}'}                                                                                                | ${'selectors with punctuation'}                                        | ${'bar'} | ${'='}   | ${'baz'}       | ${'{instance="my-host.com:9100", bar="baz"}'}
    ${'{list="a,b,c"}'}                                                                                                               | ${'selectors with punctuation'}                                        | ${'bar'} | ${'='}   | ${'baz'}       | ${'{list="a,b,c", bar="baz"}'}
    ${'rate({}[5m]) + rate({}[5m])'}                                                                                                  | ${'arithmetical expressions'}                                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({bar="baz"}[5m]) + rate({bar="baz"}[5m])'}
    ${'avg(rate({x="y"} [$__interval]))+ sum(rate({}[5m]))'}                                                                          | ${'arithmetical expressions'}                                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'avg(rate({x="y", bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}
    ${'rate({x="yy"}[5m]) * rate({y="zz",a="bb"}[5m]) * rate({}[5m])'}                                                                | ${'arithmetical expressions'}                                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({x="yy", bar="baz"}[5m]) * rate({y="zz", a="bb", bar="baz"}[5m]) * rate({bar="baz"}[5m])'}
    ${'{x="yy", bar!="baz"}'}                                                                                                         | ${'do not add duplicate labels'}                                       | ${'bar'} | ${'!='}  | ${'baz'}       | ${'{x="yy", bar!="baz"}'}
    ${'rate({bar="baz"}[1m])'}                                                                                                        | ${'do not add duplicate labels'}                                       | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({bar="baz"}[1m])'}
    ${'{list="a,b,c", bar="baz"}'}                                                                                                    | ${'do not add duplicate labels'}                                       | ${'bar'} | ${'='}   | ${'baz'}       | ${'{list="a,b,c", bar="baz"}'}
    ${'avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}                                                             | ${'do not add duplicate labels'}                                       | ${'bar'} | ${'='}   | ${'baz'}       | ${'avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}
    ${'{x="y"} |="yy"'}                                                                                                               | ${'do not remove filters'}                                             | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="y", bar="baz"} |="yy"'}
    ${'{x="y"} |="yy" !~"xx"'}                                                                                                        | ${'do not remove filters'}                                             | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="y", bar="baz"} |="yy" !~"xx"'}
    ${'{x="y"} or {}'}                                                                                                                | ${'metric with logical operators'}                                     | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="y", bar="baz"} or {bar="baz"}'}
    ${'{x="y"} and {}'}                                                                                                               | ${'metric with logical operators'}                                     | ${'bar'} | ${'='}   | ${'baz'}       | ${'{x="y", bar="baz"} and {bar="baz"}'}
    ${'sum(rate({job="foo"}[2m])) by (value $variable)'}                                                                              | ${'template variables'}                                                | ${'bar'} | ${'='}   | ${'baz'}       | ${'sum(rate({job="foo", bar="baz"}[2m])) by (value $variable)'}
    ${'rate({x="y"}[${__range_s}s])'}                                                                                                 | ${'metric query with range grafana variable'}                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({x="y", bar="baz"}[${__range_s}s])'}
    ${'max by (id, name, type) ({type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) (rate({} [5m])) * 1000'} | ${'metric query with labels in label list with the group modifier'}    | ${'bar'} | ${'='}   | ${'baz'}       | ${'max by (id, name, type) ({type=~"foo|bar|baz-test", bar="baz"}) * on(id) group_right(id, type, name) sum by (id) (rate({bar="baz"}[5m])) * 1000'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser'}                                                 | ${'bar'} | ${'='}   | ${'baz'}       | ${'{foo="bar"} | logfmt | bar=`baz`'}
    ${'{foo="bar"} | logfmt | json'}                                                                                                  | ${'query with multiple parsers'}                                       | ${'bar'} | ${'='}   | ${'baz'}       | ${'{foo="bar"} | logfmt | json | bar=`baz`'}
    ${'{foo="bar"} | logfmt | x="y"'}                                                                                                 | ${'query with parser and label filter'}                                | ${'bar'} | ${'='}   | ${'baz'}       | ${'{foo="bar"} | logfmt | x="y" | bar=`baz`'}
    ${'rate({foo="bar"} | logfmt [5m])'}                                                                                              | ${'metric query with parser'}                                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'rate({foo="bar"} | logfmt | bar=`baz` [5m])'}
    ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | line_format "{{.status}}" [5m]))'}                                           | ${'metric query with parser'}                                          | ${'bar'} | ${'='}   | ${'baz'}       | ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | bar=`baz` | line_format "{{.status}}" [5m]))'}
    ${'{foo="bar"} | logfmt | line_format "{{.status}}"'}                                                                             | ${'do not add filter to line_format expressions in query with parser'} | ${'bar'} | ${'='}   | ${'baz'}       | ${'{foo="bar"} | logfmt | bar=`baz` | line_format "{{.status}}"'}
    ${'{foo="bar"} | logfmt | line_format "{{status}}"'}                                                                              | ${'do not add filter to line_format expressions in query with parser'} | ${'bar'} | ${'='}   | ${'baz'}       | ${'{foo="bar"} | logfmt | bar=`baz` | line_format "{{status}}"'}
    ${'{}'}                                                                                                                           | ${'query without stream selector'}                                     | ${'bar'} | ${'='}   | ${'baz'}       | ${'{bar="baz"}'}
    ${'{} | logfmt'}                                                                                                                  | ${'query without stream selector and with parser'}                     | ${'bar'} | ${'='}   | ${'baz'}       | ${'{bar="baz"}| logfmt'}
    ${'{} | x="y"'}                                                                                                                   | ${'query without stream selector and with label filter'}               | ${'bar'} | ${'='}   | ${'baz'}       | ${'{bar="baz"}| x="y"'}
    ${'{} | logfmt | x="y"'}                                                                                                          | ${'query without stream selector and with parser and label filter'}    | ${'bar'} | ${'='}   | ${'baz'}       | ${'{bar="baz"}| logfmt | x="y"'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value'}                                   | ${'bar'} | ${'='}   | ${'"baz"'}     | ${'{x="yy", bar=""baz""}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value'}                                   | ${'bar'} | ${'='}   | ${'\\"baz\\"'} | ${'{x="yy", bar="\\"baz\\""}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with an other escaped value'}                          | ${'bar'} | ${'='}   | ${'baz\\\\'}   | ${'{x="yy", bar="baz\\\\"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value and regex operator'}                | ${'bar'} | ${'~='}  | ${'baz\\\\'}   | ${'{x="yy", bar~="baz\\\\"}'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value'}                              | ${'bar'} | ${'='}   | ${'\\"baz\\"'} | ${'{foo="bar"} | logfmt | bar=`"baz"`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with an other escaped value'}                     | ${'bar'} | ${'='}   | ${'baz\\\\'}   | ${'{foo="bar"} | logfmt | bar=`baz\\`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value and regex operator'}           | ${'bar'} | ${'~='}  | ${'\\"baz\\"'} | ${'{foo="bar"} | logfmt | bar~=`"baz"`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value and regex operator'}           | ${'bar'} | ${'~='}  | ${'\\"baz\\"'} | ${'{foo="bar"} | logfmt | bar~=`"baz"`'}
  `(
    'should add label to query:  $query, description: $description',
    ({ query, description, label, operator, value, expectedResult }) => {
      if (description === 'no label and value') {
        expect(() => {
          addLabelToQuery(query, label, operator, value);
        }).toThrow();
      } else {
        expect(addLabelToQuery(query, label, operator, value)).toEqual(expectedResult);
      }
    }
  );
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

describe('addLabelFormatToQuery', () => {
  it('should add label format at the end of log query when parser', () => {
    expect(addLabelFormatToQuery('{job="grafana"} | logfmt', { originalLabel: 'lvl', renameTo: 'level' })).toBe(
      '{job="grafana"} | logfmt | label_format level=lvl'
    );
  });

  it('should add label format at the end of log query when no parser', () => {
    expect(addLabelFormatToQuery('{job="grafana"}', { originalLabel: 'lvl', renameTo: 'level' })).toBe(
      '{job="grafana"} | label_format level=lvl'
    );
  });

  it('should add label format at the end of log query when more label parser', () => {
    expect(
      addLabelFormatToQuery('{job="grafana"} | logfmt | label_format a=b', { originalLabel: 'lvl', renameTo: 'level' })
    ).toBe('{job="grafana"} | logfmt | label_format a=b | label_format level=lvl');
  });

  it('should add label format at the end of log query part of metrics query', () => {
    expect(
      addLabelFormatToQuery('rate({job="grafana"} | logfmt | label_format a=b [5m])', {
        originalLabel: 'lvl',
        renameTo: 'level',
      })
    ).toBe('rate({job="grafana"} | logfmt | label_format a=b | label_format level=lvl [5m])');
  });

  it('should add label format at the end of multiple log query part of metrics query', () => {
    expect(
      addLabelFormatToQuery(
        'rate({job="grafana"} | logfmt | label_format a=b [5m]) + rate({job="grafana"} | logfmt | label_format a=b [5m])',
        { originalLabel: 'lvl', renameTo: 'level' }
      )
    ).toBe(
      'rate({job="grafana"} | logfmt | label_format a=b | label_format level=lvl [5m]) + rate({job="grafana"} | logfmt | label_format a=b | label_format level=lvl [5m])'
    );
  });
});

describe('removeCommentsFromQuery', () => {
  it.each`
    query                                                                             | expectedResult
    ${'{job="grafana"}#hello'}                                                        | ${'{job="grafana"}'}
    ${'{job="grafana"} | logfmt #hello'}                                              | ${'{job="grafana"} | logfmt '}
    ${'{job="grafana", bar="baz"} |="test" | logfmt | label_format level=lvl #hello'} | ${'{job="grafana", bar="baz"} |="test" | logfmt | label_format level=lvl '}
    ${`#sum(rate(\n{host="containers"}\n#[1m]))`}                                     | ${`\n{host="containers"}\n`}
    ${`#sum(rate(\n{host="containers"}\n#| logfmt\n#[1m]))`}                          | ${`\n{host="containers"}\n\n`}
  `('strips comments in log query:  {$query}', ({ query, expectedResult }) => {
    expect(removeCommentsFromQuery(query)).toBe(expectedResult);
  });

  it.each`
    query                                                                      | expectedResult
    ${'{job="grafana"}'}                                                       | ${'{job="grafana"}'}
    ${'{job="grafana"} | logfmt'}                                              | ${'{job="grafana"} | logfmt'}
    ${'{job="grafana", bar="baz"} |="test" | logfmt | label_format level=lvl'} | ${'{job="grafana", bar="baz"} |="test" | logfmt | label_format level=lvl'}
  `('returns original query if no comments in log query:  {$query}', ({ query, expectedResult }) => {
    expect(removeCommentsFromQuery(query)).toBe(expectedResult);
  });

  it.each`
    query                                                       | expectedResult
    ${'count_over_time({job="grafana"}[10m])#hello'}            | ${'count_over_time({job="grafana"}[10m])'}
    ${'count_over_time({job="grafana"} | logfmt[10m])#hello'}   | ${'count_over_time({job="grafana"} | logfmt[10m])'}
    ${'rate({job="grafana"} | logfmt | foo="bar" [10m])#hello'} | ${'rate({job="grafana"} | logfmt | foo="bar" [10m])'}
  `('strips comments in metrics query:  {$query}', ({ query, expectedResult }) => {
    expect(removeCommentsFromQuery(query)).toBe(expectedResult);
  });

  it.each`
    query                                                     | expectedResult
    ${'count_over_time({job="grafana"}[10m])#hello'}          | ${'count_over_time({job="grafana"}[10m])'}
    ${'count_over_time({job="grafana"} | logfmt[10m])#hello'} | ${'count_over_time({job="grafana"} | logfmt[10m])'}
    ${'rate({job="grafana"} | logfmt | foo="bar" [10m])'}     | ${'rate({job="grafana"} | logfmt | foo="bar" [10m])'}
  `('returns original query if no comments in metrics query:  {$query}', ({ query, expectedResult }) => {
    expect(removeCommentsFromQuery(query)).toBe(expectedResult);
  });
});

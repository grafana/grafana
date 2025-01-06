import { SyntaxNode } from '@lezer/common';

import {
  addDropToQuery,
  addLabelFormatToQuery,
  addLabelToQuery,
  addLineFilter,
  addNoPipelineErrorToQuery,
  addParserToQuery,
  getIdentifierInStreamPositions,
  getStreamSelectorPositions,
  NodePosition,
  queryHasFilter,
  removeCommentsFromQuery,
  removeLabelFromQuery,
} from './modifyQuery';
import { LabelType } from './types';

describe('addLabelToQuery()', () => {
  it.each`
    query                                                                                                                             | description                                                                    | label             | operator | value                               | expectedResult
    ${'{x="y"}'}                                                                                                                      | ${'no label and value'}                                                        | ${''}             | ${'='}   | ${''}                               | ${''}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query'}                                                              | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="yy", bar="baz"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query'}                                                              | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="yy", bar="baz"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'custom operator'}                                                           | ${'bar'}          | ${'!='}  | ${'baz'}                            | ${'{x="yy", bar!="baz"}'}
    ${'rate({}[1m])'}                                                                                                                 | ${'do not modify ranges'}                                                      | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({bar="baz"}[1m])'}
    ${'sum by (host) (rate({} [1m]))'}                                                                                                | ${'detect in-order function use'}                                              | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum by (host) (rate({bar="baz"}[1m]))'}
    ${'{instance="my-host.com:9100"}'}                                                                                                | ${'selectors with punctuation'}                                                | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{instance="my-host.com:9100", bar="baz"}'}
    ${'{list="a,b,c"}'}                                                                                                               | ${'selectors with punctuation'}                                                | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{list="a,b,c", bar="baz"}'}
    ${'rate({}[5m]) + rate({}[5m])'}                                                                                                  | ${'arithmetical expressions'}                                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({bar="baz"}[5m]) + rate({bar="baz"}[5m])'}
    ${'avg(rate({x="y"} [$__interval]))+ sum(rate({}[5m]))'}                                                                          | ${'arithmetical expressions'}                                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'avg(rate({x="y", bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}
    ${'rate({x="yy"}[5m]) * rate({y="zz",a="bb"}[5m]) * rate({}[5m])'}                                                                | ${'arithmetical expressions'}                                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({x="yy", bar="baz"}[5m]) * rate({y="zz", a="bb", bar="baz"}[5m]) * rate({bar="baz"}[5m])'}
    ${'{x="yy", bar!="baz"}'}                                                                                                         | ${'do not add duplicate labels'}                                               | ${'bar'}          | ${'!='}  | ${'baz'}                            | ${'{x="yy", bar!="baz"}'}
    ${'rate({bar="baz"}[1m])'}                                                                                                        | ${'do not add duplicate labels'}                                               | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({bar="baz"}[1m])'}
    ${'{list="a,b,c", bar="baz"}'}                                                                                                    | ${'do not add duplicate labels'}                                               | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{list="a,b,c", bar="baz"}'}
    ${'avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}                                                             | ${'do not add duplicate labels'}                                               | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'avg(rate({bar="baz"} [$__interval]))+ sum(rate({bar="baz"}[5m]))'}
    ${'{x="y"} |="yy"'}                                                                                                               | ${'do not remove filters'}                                                     | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="y", bar="baz"} |="yy"'}
    ${'{x="y"} |="yy" !~"xx"'}                                                                                                        | ${'do not remove filters'}                                                     | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="y", bar="baz"} |="yy" !~"xx"'}
    ${'{x="y"} or {}'}                                                                                                                | ${'metric with logical operators'}                                             | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="y", bar="baz"} or {bar="baz"}'}
    ${'{x="y"} and {}'}                                                                                                               | ${'metric with logical operators'}                                             | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{x="y", bar="baz"} and {bar="baz"}'}
    ${'sum(rate({job="foo"}[2m])) by (value $variable)'}                                                                              | ${'template variables'}                                                        | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum(rate({job="foo", bar="baz"}[2m])) by (value $variable)'}
    ${'rate({x="y"}[${__range_s}s])'}                                                                                                 | ${'metric query with range grafana variable'}                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({x="y", bar="baz"}[${__range_s}s])'}
    ${'max by (id, name, type) ({type=~"foo|bar|baz-test"}) * on(id) group_right(id, type, name) sum by (id) (rate({} [5m])) * 1000'} | ${'metric query with labels in label list with the group modifier'}            | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'max by (id, name, type) ({type=~"foo|bar|baz-test", bar="baz"}) * on(id) group_right(id, type, name) sum by (id) (rate({bar="baz"}[5m])) * 1000'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser'}                                                         | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | bar=`baz`'}
    ${'{foo="bar"} | logfmt | json'}                                                                                                  | ${'query with multiple parsers'}                                               | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | json | bar=`baz`'}
    ${'{foo="bar"} | logfmt | x="y"'}                                                                                                 | ${'query with parser and label filter'}                                        | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | x="y" | bar=`baz`'}
    ${'rate({foo="bar"} | logfmt [5m])'}                                                                                              | ${'metric query with parser'}                                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'rate({foo="bar"} | logfmt | bar=`baz` [5m])'}
    ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | line_format "{{.status}}" [5m]))'}                                           | ${'metric query with parser'}                                                  | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | bar=`baz` | line_format "{{.status}}" [5m]))'}
    ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | label_format process="{{.process}}" [5m]))'}                                 | ${'metric query with parser and label format'}                                 | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum by(host) (rate({foo="bar"} | logfmt | x="y" | label_format process="{{.process}}" | bar=`baz` [5m]))'}
    ${'{foo="bar"} | logfmt | x="y" | label_format process="{{.process}}"'}                                                           | ${'query with parser and label format'}                                        | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | x="y" | label_format process="{{.process}}" | bar=`baz`'}
    ${'{foo="bar"} | logfmt | line_format "{{.status}}"'}                                                                             | ${'do not add filter to line_format expressions in query with parser'}         | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | bar=`baz` | line_format "{{.status}}"'}
    ${'{foo="bar"} | logfmt | line_format "{{status}}"'}                                                                              | ${'do not add filter to line_format expressions in query with parser'}         | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{foo="bar"} | logfmt | bar=`baz` | line_format "{{status}}"'}
    ${'{}'}                                                                                                                           | ${'query without stream selector'}                                             | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{bar="baz"}'}
    ${'{} | logfmt'}                                                                                                                  | ${'query without stream selector and with parser'}                             | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{bar="baz"}| logfmt'}
    ${'{} | x="y"'}                                                                                                                   | ${'query without stream selector and with label filter'}                       | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{bar="baz"}| x="y"'}
    ${'{} | logfmt | x="y"'}                                                                                                          | ${'query without stream selector and with parser and label filter'}            | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'{bar="baz"}| logfmt | x="y"'}
    ${'sum(rate({x="y"} [5m])) + sum(rate({} | logfmt [5m]))'}                                                                        | ${'metric query with 1 empty and 1 not empty stream selector with parser'}     | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum(rate({x="y", bar="baz"} [5m])) + sum(rate({bar="baz"}| logfmt [5m]))'}
    ${'sum(rate({x="y"} | logfmt [5m])) + sum(rate({} [5m]))'}                                                                        | ${'metric query with 1 non-empty and 1 not empty stream selector with parser'} | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum(rate({x="y", bar="baz"} | logfmt [5m])) + sum(rate({bar="baz"}[5m]))'}
    ${'sum(rate({x="y", bar="baz"} | logfmt [5m])) + sum(rate({x="y", bar="baz"} [5m]))'}                                             | ${'metric query with two duplicate stream selectors'}                          | ${'x'}            | ${'='}   | ${'y'}                              | ${'sum(rate({x="y", bar="baz"} | logfmt [5m])) + sum(rate({x="y", bar="baz"} [5m]))'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value'}                                           | ${'bar'}          | ${'='}   | ${'"baz"'}                          | ${'{x="yy", bar=""baz""}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value'}                                           | ${'bar'}          | ${'='}   | ${'\\"baz\\"'}                      | ${'{x="yy", bar="\\"baz\\""}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with an other escaped value'}                                  | ${'bar'}          | ${'='}   | ${'baz\\\\'}                        | ${'{x="yy", bar="baz\\\\"}'}
    ${'{x="yy"}'}                                                                                                                     | ${'simple query with escaped value and regex operator'}                        | ${'bar'}          | ${'~='}  | ${'baz\\\\'}                        | ${'{x="yy", bar~="baz\\\\"}'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value'}                                      | ${'bar'}          | ${'='}   | ${'\\"baz\\"'}                      | ${'{foo="bar"} | logfmt | bar=`"baz"`'}
    ${'{foo=`"bar"`} | logfmt'}                                                                                                       | ${'query with label already added to stream selector, doublequotes/backticks'} | ${'foo'}          | ${'='}   | ${`"bar"`}                          | ${'{foo=""bar""} | logfmt'}
    ${'{foo="\\"bar\\""`} | logfmt'}                                                                                                  | ${'query with label already added to stream selector, doublequotes/escaped'}   | ${'foo'}          | ${'='}   | ${'\\"bar\\"'}                      | ${'{foo="\\"bar\\""} | logfmt'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with label already added to stream selector, doublequotes unescaped'} | ${'foo'}          | ${'='}   | ${'bar'}                            | ${'{foo="bar"} | logfmt'}
    ${'{foo=`bar`} | logfmt'}                                                                                                         | ${'query with label already added to stream selector, backticks'}              | ${'foo'}          | ${'='}   | ${'bar'}                            | ${'{foo="bar"} | logfmt'}
    ${'{service_name=`grafana/hosted-grafana-gateway`} | logfmt | caller!=`handler.go:637` '}                                         | ${'query with parser and line filter, backticks'}                              | ${'service_name'} | ${'='}   | ${'grafana/hosted-grafana-gateway'} | ${'{service_name="grafana/hosted-grafana-gateway"} | logfmt | caller!=`handler.go:637` '}
    ${'{service_name=`grafana/hosted-grafana-gateway`, pod_template_hash!=`5fd76866f4`} | logfmt | caller!=`handler.go:637`'}         | ${'query with parser and line filter, multiple stream selectors'}              | ${'service_name'} | ${'='}   | ${'grafana/hosted-grafana-gateway'} | ${'{service_name="grafana/hosted-grafana-gateway", pod_template_hash!="5fd76866f4"} | logfmt | caller!=`handler.go:637`'}
    ${'{service_name=`grafana/hosted-grafana-gateway`, x!=`y`} | logfmt | caller!=`handler.go:637`'}                                  | ${'query with parser and line filter, multiple stream selectors, value2'}      | ${'x'}            | ${'!='}  | ${'y'}                              | ${'{service_name="grafana/hosted-grafana-gateway", x!="y"} | logfmt | caller!=`handler.go:637`'}
    ${'{service_name="grafana/hosted-grafana-gateway"} | logfmt | caller!=`handler.go:637` '}                                         | ${'query with parser and line filter, doublequotes'}                           | ${'service_name'} | ${'='}   | ${'grafana/hosted-grafana-gateway'} | ${'{service_name="grafana/hosted-grafana-gateway"} | logfmt | caller!=`handler.go:637` '}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with an other escaped value'}                             | ${'bar'}          | ${'='}   | ${'baz\\\\'}                        | ${'{foo="bar"} | logfmt | bar=`baz\\`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value and regex operator'}                   | ${'bar'}          | ${'~='}  | ${'\\"baz\\"'}                      | ${'{foo="bar"} | logfmt | bar~=`"baz"`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser with escaped value and regex operator'}                   | ${'bar'}          | ${'~='}  | ${'\\"baz\\"'}                      | ${'{foo="bar"} | logfmt | bar~=`"baz"`'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser, > operator and number value'}                            | ${'bar'}          | ${'>'}   | ${'5'}                              | ${'{foo="bar"} | logfmt | bar>5'}
    ${'{foo="bar"} | logfmt'}                                                                                                         | ${'query with parser, < operator and non-number value'}                        | ${'bar'}          | ${'<'}   | ${'5KiB'}                           | ${'{foo="bar"} | logfmt | bar<`5KiB`'}
    ${'sum(rate({x="y"} | logfmt [5m])) + sum(rate({x="z"} | logfmt [5m]))'}                                                          | ${'metric query with non empty selectors and parsers'}                         | ${'bar'}          | ${'='}   | ${'baz'}                            | ${'sum(rate({x="y"} | logfmt | bar=`baz` [5m])) + sum(rate({x="z"} | logfmt | bar=`baz` [5m]))'}
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

  it('should always add label as labelFilter if label type is parsed', () => {
    expect(addLabelToQuery('{foo="bar"}', 'forcedLabel', '=', 'value', LabelType.Parsed)).toEqual(
      '{foo="bar"} | forcedLabel=`value`'
    );
  });

  it('should always add label as labelFilter if label type is parsed with parser', () => {
    expect(addLabelToQuery('{foo="bar"} | logfmt', 'forcedLabel', '=', 'value', LabelType.Parsed)).toEqual(
      '{foo="bar"} | logfmt | forcedLabel=`value`'
    );
  });

  it('should always add label as labelFilter if label type is structured', () => {
    expect(addLabelToQuery('{foo="bar"}', 'forcedLabel', '=', 'value', LabelType.StructuredMetadata)).toEqual(
      '{foo="bar"} | forcedLabel=`value`'
    );
  });

  it('should always add label as labelFilter if label type is structured with parser', () => {
    expect(addLabelToQuery('{foo="bar"} | logfmt', 'forcedLabel', '=', 'value', LabelType.StructuredMetadata)).toEqual(
      '{foo="bar"} | logfmt | forcedLabel=`value`'
    );
  });

  it('should add label as labelFilter to multiple places if label is StructuredMetadata', () => {
    expect(
      addLabelToQuery(
        'rate({foo="bar"} [$__auto]) / rate({foo="bar"} [$__auto])',
        'forcedLabel',
        '=',
        'value',
        LabelType.StructuredMetadata
      )
    ).toEqual('rate({foo="bar"} | forcedLabel=`value` [$__auto]) / rate({foo="bar"} | forcedLabel=`value` [$__auto])');
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

describe('addDropToQuery', () => {
  describe('when query has a line filter', () => {
    it('should add drop after the line filter', () => {
      expect(addDropToQuery('{job="grafana"} |= "error"', ['__stream_shard__'])).toBe(
        '{job="grafana"} |= "error" | drop __stream_shard__'
      );
    });

    it('should add the parser after multiple line filters', () => {
      expect(addDropToQuery('{job="grafana"} |= "error" |= "info" |= "debug"', ['label1', 'label2'])).toBe(
        '{job="grafana"} |= "error" |= "info" |= "debug" | drop label1, label2'
      );
    });
  });

  describe('when the query has no line filters', () => {
    it('should add the parser after the log stream selector in logs query', () => {
      expect(addDropToQuery('{job="grafana"}', ['label1', 'label2'])).toBe('{job="grafana"} | drop label1, label2');
    });

    it('should add the parser after the log stream selector in a metric query', () => {
      expect(addDropToQuery('rate({job="grafana"} [5m])', ['__stream_shard__'])).toBe(
        'rate({job="grafana"} | drop __stream_shard__ [5m])'
      );
    });

    it('should modify all metric queries', () => {
      expect(
        addDropToQuery('sum(count_over_time({job="grafana"} [5m])) + sum(count_over_time({job="grafana"} [5m]))', [
          '__stream_shard__',
        ])
      ).toBe(
        'sum(count_over_time({job="grafana"} | drop __stream_shard__ [5m])) + sum(count_over_time({job="grafana"} | drop __stream_shard__ [5m]))'
      );
    });
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
    ${'{job="grafana"}\n#hello\n| logfmt'}                                            | ${'{job="grafana"}\n\n| logfmt'}
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

describe('NodePosition', () => {
  describe('contains', () => {
    it('should return true if the position is contained within the current position', () => {
      const position = new NodePosition(5, 10);
      const containedPosition = new NodePosition(6, 9);
      const result = position.contains(containedPosition);
      expect(result).toBe(true);
    });

    it('should return false if the position is not contained within the current position', () => {
      const position = new NodePosition(5, 10);
      const outsidePosition = new NodePosition(11, 15);
      const result = position.contains(outsidePosition);
      expect(result).toBe(false);
    });

    it('should return true if the position is the same as the current position', () => {
      const position = new NodePosition(5, 10);
      const samePosition = new NodePosition(5, 10);
      const result = position.contains(samePosition);
      expect(result).toBe(true);
    });
  });

  describe('getExpression', () => {
    it('should return the substring of the query within the given position', () => {
      const position = new NodePosition(7, 12);
      const query = 'Hello, world!';
      const result = position.getExpression(query);
      expect(result).toBe('world');
    });

    it('should return an empty string if the position is out of range', () => {
      const position = new NodePosition(15, 20);
      const query = 'Hello, world!';
      const result = position.getExpression(query);
      expect(result).toBe('');
    });
  });

  describe('fromNode', () => {
    it('should create a new NodePosition instance from a SyntaxNode', () => {
      const syntaxNode = {
        from: 5,
        to: 10,
        type: 'identifier',
      } as unknown as SyntaxNode;
      const result = NodePosition.fromNode(syntaxNode);
      expect(result).toBeInstanceOf(NodePosition);
      expect(result.from).toBe(5);
      expect(result.to).toBe(10);
      expect(result.type).toBe('identifier');
    });
  });
});

describe('queryHasFilter', () => {
  it.each([
    ['{job="grafana"}', 'grafana'],
    ['{job="grafana", foo="bar"}', 'grafana'],
    ['{foo="bar", job="grafana"}', 'grafana'],
    ['{job="\\"grafana\\""}', '"grafana"'],
    ['{foo="bar"} | logfmt | job=`grafana`', 'grafana'],
  ])('should return true if query has a positive filter', (query: string, value: string) => {
    expect(queryHasFilter(query, 'job', '=', value)).toBe(true);
  });

  it.each([
    ['{job!="grafana"}', 'grafana'],
    ['{job!="grafana", foo="bar"}', 'grafana'],
    ['{foo="bar", job!="grafana"}', 'grafana'],
    ['{job!="\\"grafana\\""}', '"grafana"'],
    ['{foo="bar"} | logfmt | job!=`grafana`', 'grafana'],
  ])('should return true if query has a negative filter', (query: string, value: string) => {
    expect(queryHasFilter(query, 'job', '!=', value)).toBe(true);
  });
});

describe('removeLabelFromQuery', () => {
  it.each([
    ['{job="grafana"}', 'grafana', '{}'],
    ['{job="grafana", foo="bar"}', 'grafana', '{foo="bar"}'],
    ['{foo="bar", job="grafana"}', 'grafana', '{foo="bar"}'],
    ['{job="\\"grafana\\""}', '"grafana"', '{}'],
    ['{foo="bar"} | logfmt | job=`grafana`', 'grafana', '{foo="bar"} | logfmt'],
  ])('should remove a positive label matcher from the query', (query: string, value: string, expected: string) => {
    expect(removeLabelFromQuery(query, 'job', '=', value)).toBe(expected);
  });

  it.each([
    ['{job!="grafana"}', 'grafana', '{}'],
    ['{job!="grafana", foo="bar"}', 'grafana', '{foo="bar"}'],
    ['{foo="bar", job!="grafana"}', 'grafana', '{foo="bar"}'],
    ['{job!="\\"grafana\\""}', '"grafana"', '{}'],
    ['{foo="bar"} | logfmt | job!=`grafana`', 'grafana', '{foo="bar"} | logfmt'],
  ])('should remove a negative label matcher from the query', (query: string, value: string, expected: string) => {
    expect(removeLabelFromQuery(query, 'job', '!=', value)).toBe(expected);
  });
});

describe.each(['|=', '!='])('addLineFilter type %s', (op: string) => {
  it('Adds a line filter to a log query', () => {
    expect(addLineFilter('{place="earth"}', undefined, op)).toBe(`{place="earth"} ${op} \`\``);
  });
  it('Adds a line filter with a value to a log query', () => {
    expect(addLineFilter('{place="earth"}', 'content', op)).toBe(`{place="earth"} ${op} \`content\``);
  });
  it('Adds a line filter to a metric query', () => {
    expect(addLineFilter('avg_over_time({place="earth"} [1m])', undefined, op)).toBe(
      `avg_over_time({place="earth"} ${op} \`\` [1m])`
    );
  });
  it('Adds a line filter with a value to a metric query', () => {
    expect(addLineFilter('avg_over_time({place="earth"} [1m])', 'content', op)).toBe(
      `avg_over_time({place="earth"} ${op} \`content\` [1m])`
    );
  });
});

describe('getStreamSelectorPositions', () => {
  it('should parse position of stream selectors', () => {
    expect(
      getStreamSelectorPositions('sum(rate({x="y", bar="baz"} | logfmt [5m])) + sum(rate({x="y", bar="baz"} [5m]))')
    ).toEqual([
      {
        from: 9,
        to: 27,
        type: {
          name: 'Selector',
          props: {},
          id: 40,
          flags: 0,
        },
      },
      {
        from: 55,
        to: 73,
        type: {
          name: 'Selector',
          props: {},
          id: 40,
          flags: 0,
        },
      },
    ]);
  });
});
describe('getIdentifierInStreamPositions', () => {
  it('should parse position of stream selectors', () => {
    const indexedKeys = ['x', 'bar'];
    const expr = `sum(rate({${indexedKeys[0]}="y", ${indexedKeys[1]}="baz"} | logfmt | x |= "x=y" |= "bar=baz" [5m])) + sum(rate({${indexedKeys[0]}="y", ${indexedKeys[1]}="baz"} [5m]))`;
    const identifiers = getIdentifierInStreamPositions(expr);
    identifiers.forEach((identifier, index) => {
      expect(identifier.getExpression(expr)).toEqual(indexedKeys[index % 2]);
    });
    expect(identifiers).toEqual([
      //x1
      {
        from: 10,
        to: 11,
        type: {
          name: 'Identifier',
          props: {},
          id: 43,
          flags: 0,
        },
      },
      //bar1
      {
        from: 17,
        to: 20,
        type: {
          name: 'Identifier',
          props: {},
          id: 43,
          flags: 0,
        },
      },
      //x2
      {
        from: 82,
        to: 83,
        type: {
          name: 'Identifier',
          props: {},
          id: 43,
          flags: 0,
        },
      },
      //bar2
      {
        from: 89,
        to: 92,
        type: {
          name: 'Identifier',
          props: {},
          id: 43,
          flags: 0,
        },
      },
    ]);
  });
});

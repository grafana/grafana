import { String } from '@grafana/lezer-logql';

import {
  getHighlighterExpressionsFromQuery,
  getLokiQueryType,
  isLogsQuery,
  isQueryWithLabelFormat,
  isQueryWithParser,
  isQueryWithError,
  parseToNodeNamesArray,
  getParserFromQuery,
  obfuscate,
  requestSupportsSplitting,
  isQueryWithDistinct,
  isQueryWithRangeVariable,
  isQueryPipelineErrorFiltering,
  getLogQueryFromMetricsQuery,
  getNormalizedLokiQuery,
  getNodePositionsFromQuery,
  formatLogqlQuery,
} from './queryUtils';
import { LokiQuery, LokiQueryType } from './types';

describe('getHighlighterExpressionsFromQuery', () => {
  it('returns no expressions for empty query', () => {
    expect(getHighlighterExpressionsFromQuery('')).toEqual([]);
  });

  it('returns no expression for query with empty filter ', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= ``')).toEqual([]);
  });

  it('returns no expression for query with empty filter and parser', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= `` | json count="counter" | __error__=``')).toEqual([]);
  });

  it('returns no expression for query with empty filter and chained filter', () => {
    expect(
      getHighlighterExpressionsFromQuery('{foo="bar"} |= `` |= `highlight` | json count="counter" | __error__=``')
    ).toEqual(['highlight']);
  });

  it('returns no expression for query with empty filter, chained and regex filter', () => {
    expect(
      getHighlighterExpressionsFromQuery(
        '{foo="bar"} |= `` |= `highlight` |~ `high.ight` | json count="counter" | __error__=``'
      )
    ).toEqual(['highlight', 'high.ight']);
  });

  it('returns no expression for query with empty filter, chained and regex quotes filter', () => {
    expect(
      getHighlighterExpressionsFromQuery(
        '{foo="bar"} |= `` |= `highlight` |~ "highlight\\\\d" | json count="counter" | __error__=``'
      )
    ).toEqual(['highlight', 'highlight\\d']);
  });

  it('returns an expression for query with filter using quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x"')).toEqual(['x']);
  });

  it('returns an expression for query with filter using backticks', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= `x`')).toEqual(['x']);
  });

  it('returns expressions for query with filter chain', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y"')).toEqual(['x', 'y']);
  });

  it('returns expressions for query with filter chain using both backticks and quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ `y`')).toEqual(['x', 'y']);
  });

  it('returns expression for query with log parser', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" | logfmt')).toEqual(['x']);
  });

  it('returns expressions for query with filter chain followed by log parser', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y" | logfmt')).toEqual(['x', 'y']);
  });

  it('returns drops expressions for query with negative filter chain using quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" != "y"')).toEqual(['x']);
  });

  it('returns expressions for query with filter chain using backticks', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= `x` |~ `y`')).toEqual(['x', 'y']);
  });

  it('returns expressions for query with filter chain using quotes and backticks', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ `y`')).toEqual(['x', 'y']);
  });

  it('returns null if filter term is not wrapped in double quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= x')).toEqual([]);
  });

  it('escapes filter term if regex filter operator is not used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x[yz].w"')).toEqual(['x\\[yz\\]\\.w']);
  });

  it('does not escape filter term if regex filter operator is used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ "x[yz].w" |~ "z.+"')).toEqual(['x[yz].w', 'z.+']);
  });

  it('removes extra backslash escaping if regex filter operator and quotes are used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ "\\\\w+"')).toEqual(['\\w+']);
  });

  it('does not remove backslash escaping if regex filter operator and backticks are used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ `\\w+`')).toEqual(['\\w+']);
  });

  it.each`
    input          | expected
    ${'`"test"`'}  | ${'"test"'}
    ${'"`test`"'}  | ${'`test`'}
    ${'`"test"a`'} | ${'"test"a'}
  `('should correctly identify the type of quote used in the term', ({ input, expected }) => {
    expect(getHighlighterExpressionsFromQuery(`{foo="bar"} |= ${input}`)).toEqual([expected]);
  });
});

describe('getNormalizedLokiQuery', () => {
  it('removes deprecated instant property', () => {
    const input: LokiQuery = { refId: 'A', expr: 'test1', instant: true };
    const output = getNormalizedLokiQuery(input);
    expect(output).toStrictEqual({ refId: 'A', expr: 'test1', queryType: LokiQueryType.Instant });
  });

  it('removes deprecated range property', () => {
    const input: LokiQuery = { refId: 'A', expr: 'test1', range: true };
    const output = getNormalizedLokiQuery(input);
    expect(output).toStrictEqual({ refId: 'A', expr: 'test1', queryType: LokiQueryType.Range });
  });

  it('removes deprecated range and instant properties if query with queryType', () => {
    const input: LokiQuery = { refId: 'A', expr: 'test1', range: true, instant: false, queryType: LokiQueryType.Range };
    const output = getNormalizedLokiQuery(input);
    expect(output).toStrictEqual({ refId: 'A', expr: 'test1', queryType: LokiQueryType.Range });
  });
});
describe('getLokiQueryType', () => {
  function expectCorrectQueryType(inputProps: Object, outputQueryType: LokiQueryType) {
    const input: LokiQuery = { refId: 'A', expr: 'test1', ...inputProps };
    const output = getLokiQueryType(input);
    expect(output).toStrictEqual(outputQueryType);
  }

  it('handles no props case', () => {
    expectCorrectQueryType({}, LokiQueryType.Range);
  });

  it('handles old-style instant case', () => {
    expectCorrectQueryType({ instant: true, range: false }, LokiQueryType.Instant);
  });

  it('handles old-style range case', () => {
    expectCorrectQueryType({ instant: false, range: true }, LokiQueryType.Range);
  });

  it('handles new+old style instant', () => {
    expectCorrectQueryType({ instant: true, range: false, queryType: LokiQueryType.Range }, LokiQueryType.Range);
  });

  it('handles new+old style range', () => {
    expectCorrectQueryType({ instant: false, range: true, queryType: LokiQueryType.Instant }, LokiQueryType.Instant);
  });

  it('handles new<>old conflict (new wins), range', () => {
    expectCorrectQueryType({ instant: false, range: true, queryType: LokiQueryType.Range }, LokiQueryType.Range);
  });

  it('handles new<>old conflict (new wins), instant', () => {
    expectCorrectQueryType({ instant: true, range: false, queryType: LokiQueryType.Instant }, LokiQueryType.Instant);
  });

  it('handles invalid new, range', () => {
    expectCorrectQueryType({ queryType: 'invalid' }, LokiQueryType.Range);
  });

  it('handles invalid new, when old-range exists, use old', () => {
    expectCorrectQueryType({ instant: false, range: true, queryType: 'invalid' }, LokiQueryType.Range);
  });

  it('handles invalid new, when old-instant exists, use old', () => {
    expectCorrectQueryType({ instant: true, range: false, queryType: 'invalid' }, LokiQueryType.Instant);
  });
});

describe('isQueryWithError', () => {
  it('returns false if invalid query', () => {
    expect(isQueryWithError('{job="grafana')).toBe(true);
  });
  it('returns true if valid query', () => {
    expect(isQueryWithError('{job="grafana"}')).toBe(false);
  });
});

describe('parseToNodeNamesArray', () => {
  it('returns on empty query', () => {
    expect(parseToNodeNamesArray('{}')).toEqual(['LogQL', 'Expr', 'LogExpr', 'Selector', '⚠']);
  });
  it('returns on invalid query', () => {
    expect(parseToNodeNamesArray('{job="grafana"')).toEqual([
      'LogQL',
      'Expr',
      'LogExpr',
      'Selector',
      'Matchers',
      'Matcher',
      'Identifier',
      'Eq',
      'String',
      '⚠',
    ]);
  });
  it('returns on valid query', () => {
    expect(parseToNodeNamesArray('{job="grafana"}')).toEqual([
      'LogQL',
      'Expr',
      'LogExpr',
      'Selector',
      'Matchers',
      'Matcher',
      'Identifier',
      'Eq',
      'String',
    ]);
  });
});

describe('obfuscate', () => {
  it('obfuscates on invalid query', () => {
    expect(obfuscate('{job="grafana"')).toEqual('{Identifier=String');
  });
  it('obfuscates on valid query', () => {
    expect(
      obfuscate('sum(sum_over_time({test="test"} |= `` | logfmt | __error__=`` | unwrap test | __error__=`` [10m]))')
    ).toEqual(
      'sum(sum_over_time({Identifier=String} |= String | logfmt | __error__=String | unwrap Identifier | __error__=String [10m]))'
    );
  });
  it('obfuscates on arithmetic operation', () => {
    expect(obfuscate('2 + 3')).toEqual('Number + Number');
  });
  it('obfuscates a comment', () => {
    expect(obfuscate('{job="grafana"} # test comment')).toEqual('{Identifier=String} LineComment');
  });
  it('does not obfuscate interval variables', () => {
    expect(
      obfuscate(
        'sum(quantile_over_time(0.5, {label="$var"} | logfmt | __error__=`` | unwrap latency | __error__=`` [$__interval]))'
      )
    ).toEqual(
      'sum(quantile_over_time(Number, {Identifier=String} | logfmt | __error__=String | unwrap Identifier | __error__=String [$__interval]))'
    );
  });
});

describe('isLogsQuery', () => {
  it('returns false if metrics query', () => {
    expect(isLogsQuery('rate({job="grafana"}[5m])')).toBe(false);
  });
  it('returns true if valid query', () => {
    expect(isLogsQuery('{job="grafana"}')).toBe(true);
  });
});

describe('isQueryWithParser', () => {
  it('returns false if query without parser', () => {
    expect(isQueryWithParser('rate({job="grafana" |= "error" }[5m])')).toEqual({
      parserCount: 0,
      queryWithParser: false,
    });
  });
  it('returns true if log query with parser', () => {
    expect(isQueryWithParser('{job="grafana"} | json')).toEqual({ parserCount: 1, queryWithParser: true });
  });

  it('returns true if metric query with parser', () => {
    expect(isQueryWithParser('rate({job="grafana"} | json [5m])')).toEqual({ parserCount: 1, queryWithParser: true });
  });

  it('returns true if query with json parser with expressions', () => {
    expect(isQueryWithParser('rate({job="grafana"} | json foo="bar", bar="baz" [5m])')).toEqual({
      parserCount: 1,
      queryWithParser: true,
    });
  });
});

describe('isQueryWithLabelFormat', () => {
  it('returns true if log query with label format', () => {
    expect(isQueryWithLabelFormat('{job="grafana"} | label_format level=lvl')).toBe(true);
  });

  it('returns true if metrics query with label format', () => {
    expect(isQueryWithLabelFormat('rate({job="grafana"} | label_format level=lvl [5m])')).toBe(true);
  });

  it('returns false if log query without label format', () => {
    expect(isQueryWithLabelFormat('{job="grafana"} | json')).toBe(false);
  });

  it('returns false if metrics query without label format', () => {
    expect(isQueryWithLabelFormat('rate({job="grafana"} [5m])')).toBe(false);
  });
});

describe('isQueryWithDistinct', () => {
  it('identifies queries using distinct', () => {
    expect(isQueryWithDistinct('{job="grafana"} | distinct id')).toBe(true);
    expect(isQueryWithDistinct('count_over_time({job="grafana"} | distinct id [1m])')).toBe(true);
  });

  it('does not return false positives', () => {
    expect(isQueryWithDistinct('{label="distinct"} | logfmt')).toBe(false);
    expect(isQueryWithDistinct('count_over_time({job="distinct"} | json [1m])')).toBe(false);
  });
});

describe('isQueryWithRangeVariableDuration', () => {
  it('identifies queries using $__range variable', () => {
    expect(isQueryWithRangeVariable('rate({job="grafana"}[$__range])')).toBe(true);
  });

  it('identifies queries using $__range_s variable', () => {
    expect(isQueryWithRangeVariable('rate({job="grafana"}[$__range_s])')).toBe(true);
  });

  it('identifies queries using $__range_ms variable', () => {
    expect(isQueryWithRangeVariable('rate({job="grafana"}[$__range_ms])')).toBe(true);
  });

  it('does not return false positives', () => {
    expect(isQueryWithRangeVariable('rate({job="grafana"} | logfmt | value="$__range" [5m])')).toBe(false);
    expect(isQueryWithRangeVariable('rate({job="grafana"} | logfmt | value="[$__range]" [5m])')).toBe(false);
    expect(isQueryWithRangeVariable('rate({job="grafana"} [$range])')).toBe(false);
    expect(isQueryWithRangeVariable('rate({job="grafana"} [$_range])')).toBe(false);
    expect(isQueryWithRangeVariable('rate({job="grafana"} [$_range_ms])')).toBe(false);
  });
});

describe('getParserFromQuery', () => {
  it('returns no parser', () => {
    expect(getParserFromQuery('{job="grafana"}')).toBeUndefined();
  });

  it.each(['json', 'logfmt', 'pattern', 'regexp', 'unpack'])('detects %s parser', (parser: string) => {
    expect(getParserFromQuery(`{job="grafana"} | ${parser}`)).toBe(parser);
    expect(getParserFromQuery(`sum(count_over_time({place="luna"} | ${parser} | unwrap counter )) by (place)`)).toBe(
      parser
    );
  });
});

describe('requestSupportsSplitting', () => {
  it('hidden requests are not partitioned', () => {
    const requests: LokiQuery[] = [
      {
        expr: '{a="b"}',
        refId: 'A',
        hide: true,
      },
    ];
    expect(requestSupportsSplitting(requests)).toBe(false);
  });
  it('special requests are not partitioned', () => {
    const requests: LokiQuery[] = [
      {
        expr: '{a="b"}',
        refId: 'do-not-chunk',
      },
    ];
    expect(requestSupportsSplitting(requests)).toBe(false);
  });
  it('empty requests are not partitioned', () => {
    const requests: LokiQuery[] = [
      {
        expr: '',
        refId: 'A',
      },
    ];
    expect(requestSupportsSplitting(requests)).toBe(false);
  });
  it('all other requests are partitioned', () => {
    const requests: LokiQuery[] = [
      {
        expr: '{a="b"}',
        refId: 'A',
      },
      {
        expr: 'count_over_time({a="b"}[1h])',
        refId: 'B',
      },
    ];
    expect(requestSupportsSplitting(requests)).toBe(true);
  });
});

describe('isQueryPipelineErrorFiltering', () => {
  it('identifies pipeline error filters', () => {
    expect(isQueryPipelineErrorFiltering('{job="grafana"} | logfmt | __error__=""')).toBe(true);
    expect(isQueryPipelineErrorFiltering('{job="grafana"} | logfmt | error=""')).toBe(false);
  });
});

describe('getLogQueryFromMetricsQuery', () => {
  it('returns the log query from a metric query', () => {
    expect(getLogQueryFromMetricsQuery('count_over_time({job="grafana"} | logfmt | label="value" [1m])')).toBe(
      '{job="grafana"} | logfmt | label="value"'
    );
    expect(getLogQueryFromMetricsQuery('count_over_time({job="grafana"} [1m])')).toBe('{job="grafana"}');
    expect(
      getLogQueryFromMetricsQuery(
        'sum(quantile_over_time(0.5, {label="$var"} | logfmt | __error__=`` | unwrap latency | __error__=`` [$__interval]))'
      )
    ).toBe('{label="$var"} | logfmt | __error__=``');
  });
});

describe('getNodePositionsFromQuery', () => {
  it('returns the right amount of positions without type', () => {
    // LogQL, Expr, LogExpr, Selector, Matchers, Matcher, Identifier, Eq, String
    expect(getNodePositionsFromQuery('{job="grafana"}').length).toBe(9);
  });

  it('returns the right position of a string in a stream selector', () => {
    // LogQL, Expr, LogExpr, Selector, Matchers, Matcher, Identifier, Eq, String
    const nodePositions = getNodePositionsFromQuery('{job="grafana"}', [String]);
    expect(nodePositions.length).toBe(1);
    expect(nodePositions[0].from).toBe(5);
    expect(nodePositions[0].to).toBe(14);
  });

  it('returns an empty array with a wrong expr', () => {
    // LogQL, Expr, LogExpr, Selector, Matchers, Matcher, Identifier, Eq, String
    const nodePositions = getNodePositionsFromQuery('not loql', [String]);
    expect(nodePositions.length).toBe(0);
  });
});

describe('formatLogqlQuery', () => {
  describe('LogExpr', () => {
    it('spaces labels in selectors', () => {
      expect(formatLogqlQuery(`{labelA="A",labelB="B",labelC="C",labelD="D"}`)).toBe(
        `{labelA="A", labelB="B", labelC="C", labelD="D"}`
      );
    });

    it('orders labels in selectors', () => {
      expect(formatLogqlQuery(`{labelB="B", labelA="A"}`)).toBe(`{labelA="A", labelB="B"}`);
    });

    it('formats mixed pipeline expressions', () => {
      expect(formatLogqlQuery(`{label=""}|=""|json|decolorize`)).toBe(`{label=""}\n  |= ""\n  | json\n  | decolorize`);
    });

    it('handles line filters', () => {
      expect(formatLogqlQuery(`{label=""}|="contains"!="not contains"|~"regex match"!~"not regex match"`)).toBe(
        `{label=""}\n  |= "contains" != "not contains" |~ "regex match" !~ "not regex match"`
      );
      expect(formatLogqlQuery(`{label=""}|=""`)).toBe(`{label=""}\n  |= ""`);
      expect(formatLogqlQuery(`{label=""}!=""`)).toBe(`{label=""}\n  != ""`);
      expect(formatLogqlQuery(`{label=""}|~""`)).toBe(`{label=""}\n  |~ ""`);
      expect(formatLogqlQuery(`{label=""}!~""`)).toBe(`{label=""}\n  !~ ""`);
    });

    it('handles label parsers', () => {
      expect(formatLogqlQuery(`{label=""}|json`)).toBe(`{label=""}\n  | json`);
      expect(formatLogqlQuery(`{label=""}|logfmt`)).toBe(`{label=""}\n  | logfmt`);
      expect(formatLogqlQuery(`{label=""}|regexp ""`)).toBe(`{label=""}\n  | regexp""`);
      expect(formatLogqlQuery(`{label=""}|unpack`)).toBe(`{label=""}\n  | unpack`);
      expect(formatLogqlQuery(`{label=""}|pattern ""`)).toBe(`{label=""}\n  | pattern""`);
    });

    it('handles json expression parsers', () => {
      expect(formatLogqlQuery(`{label=""}|json label=""`)).toBe(`{label=""}\n  | json label=""`);
      expect(formatLogqlQuery(`{label=""}|json labelA="A",labelB="B"`)).toBe(
        `{label=""}\n  | json labelA="A", labelB="B"`
      );
    });

    it('handles label filters', () => {
      expect(formatLogqlQuery(`{label=""} | label=""`)).toBe(`{label=""}\n  | label=""`);
      expect(formatLogqlQuery(`{label=""} | label=ip("")`)).toBe(`{label=""}\n  | label=ip("")`);
      expect(formatLogqlQuery(`{label=""} | label=10s`)).toBe(`{label=""}\n  | label=10s`);
      expect(formatLogqlQuery(`{label=""} | label=1GB`)).toBe(`{label=""}\n  | label=1GB`);
      expect(formatLogqlQuery(`{label=""} | label=42`)).toBe(`{label=""}\n  | label=42`);
      // expect(formatLogqlQuery(`{label=""} | labelA="A" and labelB="B"`)).toBe(
      //   `{label=""}\n  | labelA="A" and labelB="B"`
      // );
      // expect(formatLogqlQuery(`{label=""} | labelA="A" or labelB="B"`)).toBe(
      //   `{label=""}\n  | labelA="A" or labelB="B"`
      // );
      // expect(formatLogqlQuery(`{label=""} | labelA="A", labelB="B"`)).toBe(`{label=""}\n  | labelA="A", d labelB="B"`);
    });

    it('handles line format expressions', () => {
      expect(formatLogqlQuery(`{label=""}|line_format""`)).toBe(`{label=""}\n  | line_format ""`);
    });

    it('handles label format expressions', () => {
      expect(formatLogqlQuery(`{label=""}|label_format label=""`)).toBe(`{label=""}\n  | label_format label=""`);
      expect(formatLogqlQuery(`{label=""}|label_format label="",label=""`)).toBe(
        `{label=""}\n  | label_format label="", label=""`
      );
      expect(formatLogqlQuery(`{label=""}|label_format labelA=labelB`)).toBe(
        `{label=""}\n  | label_format labelA=labelB`
      );
      expect(formatLogqlQuery(`{label=""}|label_format labelA=labelB,labelA=labelB`)).toBe(
        `{label=""}\n  | label_format labelA=labelB, labelA=labelB`
      );
      expect(formatLogqlQuery(`{label=""}|label_format label="",labelA=labelB`)).toBe(
        `{label=""}\n  | label_format label="", labelA=labelB`
      );
    });

    it('handles distinct filters', () => {
      expect(formatLogqlQuery(`{label=""}|distinct label`)).toBe(`{label=""}\n  | distinct label`);
      expect(formatLogqlQuery(`{label=""}|distinct labelA,labelB`)).toBe(`{label=""}\n  | distinct labelA, labelB`);
    });

    it('handles decolorize expressions', () => {
      expect(formatLogqlQuery(`{label=""}|decolorize`)).toBe(`{label=""}\n  | decolorize`);
    });

    it('handles log expressions wrapped in "(" ")"', () => {
      expect(formatLogqlQuery(`({labelB="B",labelA="A"})`)).toBe(`({labelA="A", labelB="B"})`);
      // expect(formatLogqlQuery(`({label=""}|=""|json|decolorize)`)).toBe(`({label=""}\n  |= ""\n  | json\n  | decolorize)`);
    });
  });

  describe('MetricExpr', () => {
    it('handles range aggregation expressions', () => {
      expect(formatLogqlQuery(`rate({label=""}[1s])`)).toBe(`rate(\n  {label=""}\n  [1s]\n)`);
      expect(formatLogqlQuery(`rate(0.99,{label=""}[1s])`)).toBe(`rate(\n  0.99,\n  {label=""}\n  [1s]\n)`);
      expect(formatLogqlQuery(`rate({label=""}[1s])by(label)`)).toBe(`rate(\n  {label=""}\n  [1s]\n) by (label)`);
    });

    // This has been a source of many bugs throughout the development process, so we test it thoroughly.
    it('handles complex range aggregation expressions', () => {
      // Selector Range
      expect(formatLogqlQuery(`rate({label=""}[1s])`)).toBe(`rate(\n  {label=""}\n  [1s]\n)`);

      // Selector Range OffsetExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]offset 1h)`)).toBe(`rate(\n  {label=""}\n  [1s] offset 1h\n)`);

      // "(" Selector ")" Range
      expect(formatLogqlQuery(`rate(({label=""})[1s])`)).toBe(`rate(\n  {label=""}\n  [1s]\n)`);

      // "(" Selector ")" Range OffsetExpr
      expect(formatLogqlQuery(`rate(({label=""})[1s]offset 1h)`)).toBe(`rate(\n  {label=""}\n  [1s] offset 1h\n)`);

      // Selector Range UnwrapExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s] | unwrap label\n)`
      );

      // Selector Range OffsetExpr UnwrapExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]offset 1h|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s] offset 1h | unwrap label\n)`
      );

      // "(" Selector ")" Range UnwrapExpr |
      expect(formatLogqlQuery(`rate(({label=""})[1s]|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s] | unwrap label\n)`
      );

      // "(" Selector ")" Range OffsetExpr UnwrapExpr |
      expect(formatLogqlQuery(`rate(({label=""})[1s]offset 1h|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s] offset 1h | unwrap label\n)`
      );

      // Selector UnwrapExpr Range
      expect(formatLogqlQuery(`rate({label=""}|unwrap label[1s])`)).toBe(
        `rate(\n  {label=""}\n  | unwrap label\n  [1s]\n)`
      );

      // Selector UnwrapExpr Range OffsetExpr
      expect(formatLogqlQuery(`rate({label=""}|unwrap label[1s]offset 1h)`)).toBe(
        `rate(\n  {label=""}\n  | unwrap label\n  [1s] offset 1h\n)`
      );

      // "(" Selector UnwrapExpr ")" Range
      expect(formatLogqlQuery(`rate(({label=""} |unwrap label)[1s])`)).toBe(
        `rate(\n  {label=""}\n  | unwrap label\n  [1s]\n)`
      );

      // "(" Selector UnwrapExpr ")" Range OffsetExpr
      expect(formatLogqlQuery(`rate(({label=""} |unwrap label)[1s] offset 1h)`)).toBe(
        `rate(\n  {label=""}\n  | unwrap label\n  [1s] offset 1h\n)`
      );

      // Selector PipelineExpr Range
      expect(formatLogqlQuery(`rate({label=""}|=""|logfmt[1s])`)).toBe(
        `rate(\n  {label=""}\n    |= ""\n    | logfmt\n  [1s]\n)`
      );

      // Selector PipelineExpr Range OffsetExpr
      expect(formatLogqlQuery(`rate({label=""}|=""|logfmt[1s]offset 1h)`)).toBe(
        `rate(\n  {label=""}\n    |= ""\n    | logfmt\n  [1s] offset 1h\n)`
      );

      // "(" Selector PipelineExpr ")" Range
      expect(formatLogqlQuery(`rate(({label=""}|=""|logfmt)[1s])`)).toBe(
        `rate(\n  {label=""}\n    |= ""\n    | logfmt\n  [1s]\n)`
      );

      // "(" Selector PipelineExpr ")" Range OffsetExpr
      expect(formatLogqlQuery(`rate(({label=""}|=""|logfmt)[1s]offset 1h)`)).toBe(
        `rate(\n  {label=""}\n    |= ""\n    | logfmt\n  [1s] offset 1h\n)`
      );

      // Selector Range PipelineExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]|=""|logfmt)`)).toBe(
        `rate(\n  {label=""}\n  [1s]\n    |= ""\n    | logfmt\n)`
      );

      // Selector Range OffsetExpr PipelineExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]offset 1h|=""|logfmt)`)).toBe(
        `rate(\n  {label=""}\n  [1s] offset 1h\n    |= ""\n    | logfmt\n)`
      );

      // Selector Range PipelineExpr UnwrapExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]|=""|logfmt|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s]\n    |= ""\n    | logfmt\n  | unwrap label\n)`
      );

      // Selector PipelineExpr UnwrapExpr Range
      expect(formatLogqlQuery(`rate({label=""}|=""|logfmt|unwrap label[1s])`)).toBe(
        `rate(\n  {label=""}\n    |= ""\n    | logfmt\n  | unwrap label\n  [1s]\n)`
      );

      // Selector Range OffsetExpr PipelineExpr UnwrapExpr
      expect(formatLogqlQuery(`rate({label=""}[1s]offset 1h|=""|logfmt|unwrap label)`)).toBe(
        `rate(\n  {label=""}\n  [1s] offset 1h\n    |= ""\n    | logfmt\n  | unwrap label\n)`
      );

      // "(" LogRangeExpr ")"
      expect(formatLogqlQuery(`(rate({label=""}[1s]))`)).toBe(`(rate(\n  {label=""}\n  [1s]\n))`);
      expect(formatLogqlQuery(`(rate({label=""}[1s]offset 1h|=""|logfmt|unwrap label))`)).toBe(
        `(rate(\n  {label=""}\n  [1s] offset 1h\n    |= ""\n    | logfmt\n  | unwrap label\n))`
      );
    });

    it('handles vector aggregation expressions', () => {
      expect(formatLogqlQuery(`sum(rate({label=""}[1s]))`)).toBe(`sum(\n  rate(\n    {label=""}\n    [1s]\n  )\n)`);
      expect(formatLogqlQuery(`sum by(abc)(rate({label=""}[1s]))`)).toBe(
        `sum by (abc) (\n  rate(\n    {label=""}\n    [1s]\n  )\n)`
      );
      expect(formatLogqlQuery(`sum(rate({label=""}[1s]))by(abc)`)).toBe(
        `sum(\n  rate(\n    {label=""}\n    [1s]\n  )\n) by (abc)`
      );
      expect(formatLogqlQuery(`sum(0.99, rate({label=""}[1s]))`)).toBe(
        `sum(\n  0.99,\n  rate(\n    {label=""}\n    [1s]\n  )\n)`
      );
      expect(formatLogqlQuery(`sum(0.99, rate({label=""}[1s]))by(abc)`)).toBe(
        `sum(\n  0.99,\n  rate(\n    {label=""}\n    [1s]\n  )\n) by (abc)`
      );
      expect(formatLogqlQuery(`sum by(abc)(0.99, rate({label=""}[1s]))by(abc)`)).toBe(
        `sum by (abc) (\n  0.99,\n  rate(\n    {label=""}\n    [1s]\n  )\n)`
      );
      // expect(formatLogqlQuery(`sum(sum(rate({label=""}[1s])))`)).toBe(
      //   `sum(\n  sum(\n    rate(\n      {label=""}\n      [1s]\n    )\n  )\n)`
      // );
    });

    it('handles binary operator expressions', () => {
      expect(formatLogqlQuery(`rate({label=""}[1s]) + rate({label=""}[5s])`)).toBe(
        `rate(\n  {label=""}\n  [1s]\n)\n+\nrate(\n  {label=""}\n  [5s]\n)`
      );
      expect(formatLogqlQuery(`10 + rate({label=""}[1s])`)).toBe(`10\n+\nrate(\n  {label=""}\n  [1s]\n)`);
      // expect(formatLogqlQuery(`1 + 2 + 3`)).toBe(`1\n+\n2\n+\n3`);
    });

    it('handles literal expressions', () => {
      expect(formatLogqlQuery(`10`)).toBe(`10`);
      expect(formatLogqlQuery(`- 10`)).toBe(`-10`);
      expect(formatLogqlQuery(`+ 10`)).toBe(`+10`);
    });

    it('handles label replace expressions', () => {
      expect(formatLogqlQuery(`label_replace(rate({label=""}[1s]), "", "", "", "")`)).toBe(
        `label_replace(\n  rate(\n    {label=""}\n    [1s]\n  ),\n  "",\n  "",\n  "",\n  ""\n)`
      );
    });

    it('handles vector expressions', () => {
      expect(formatLogqlQuery(`rate({source="data"}[1s]) or vector( 10 )`)).toBe(
        `rate(\n  {source="data"}\n  [1s]\n)\nor\nvector(10)`
      );
      expect(formatLogqlQuery(`vector ( 10 )`)).toBe(`vector(10)`);
    });

    it('handles metric expressions wrapped in "(" ")"', () => {
      expect(formatLogqlQuery(`(rate({source="data"}[1s]))`)).toBe(`(rate(\n  {source="data"}\n  [1s]\n))`);
      expect(formatLogqlQuery(`(+1 + -1)`)).toBe(`(+1\n+\n-1)`);
    });
  });
});

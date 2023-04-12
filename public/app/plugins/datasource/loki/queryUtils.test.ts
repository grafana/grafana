import {
  getHighlighterExpressionsFromQuery,
  getNormalizedLokiQuery,
  isLogsQuery,
  isQueryWithLabelFormat,
  isQueryWithParser,
  isValidQuery,
  parseToNodeNamesArray,
  getParserFromQuery,
  obfuscate,
  requestSupportsSplitting,
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

  it('returns expressions for query with negative filter chain using both backticks and quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} != "x" !~ `y`')).toEqual(['-x', '-y']);
  });

  it('returns expression for query with log parser', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" | logfmt')).toEqual(['x']);
  });

  it('returns expressions for query with filter chain followed by log parser', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y" | logfmt')).toEqual(['x', 'y']);
  });

  it('returns expressions for query with negative filter chain using quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" != "y"')).toEqual(['x', '-y']);
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
  function expectNormalized(inputProps: Object, outputQueryType: LokiQueryType) {
    const input: LokiQuery = { refId: 'A', expr: 'test1', ...inputProps };
    const output = getNormalizedLokiQuery(input);
    expect(output).toStrictEqual({ refId: 'A', expr: 'test1', queryType: outputQueryType });
  }

  it('handles no props case', () => {
    expectNormalized({}, LokiQueryType.Range);
  });

  it('handles old-style instant case', () => {
    expectNormalized({ instant: true, range: false }, LokiQueryType.Instant);
  });

  it('handles old-style range case', () => {
    expectNormalized({ instant: false, range: true }, LokiQueryType.Range);
  });

  it('handles new+old style instant', () => {
    expectNormalized({ instant: true, range: false, queryType: LokiQueryType.Range }, LokiQueryType.Range);
  });

  it('handles new+old style range', () => {
    expectNormalized({ instant: false, range: true, queryType: LokiQueryType.Instant }, LokiQueryType.Instant);
  });

  it('handles new<>old conflict (new wins), range', () => {
    expectNormalized({ instant: false, range: true, queryType: LokiQueryType.Range }, LokiQueryType.Range);
  });

  it('handles new<>old conflict (new wins), instant', () => {
    expectNormalized({ instant: true, range: false, queryType: LokiQueryType.Instant }, LokiQueryType.Instant);
  });

  it('handles invalid new, range', () => {
    expectNormalized({ queryType: 'invalid' }, LokiQueryType.Range);
  });

  it('handles invalid new, when old-range exists, use old', () => {
    expectNormalized({ instant: false, range: true, queryType: 'invalid' }, LokiQueryType.Range);
  });

  it('handles invalid new, when old-instant exists, use old', () => {
    expectNormalized({ instant: true, range: false, queryType: 'invalid' }, LokiQueryType.Instant);
  });
});

describe('isValidQuery', () => {
  it('returns false if invalid query', () => {
    expect(isValidQuery('{job="grafana')).toBe(false);
  });
  it('returns true if valid query', () => {
    expect(isValidQuery('{job="grafana"}')).toBe(true);
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

import { Matcher, MatcherOperator, Route } from '../../../../plugins/datasource/alertmanager/types';

import {
  encodeMatcher,
  getMatcherQueryParams,
  isPromQLStyleMatcher,
  matcherToObjectMatcher,
  normalizeMatchers,
  parseMatcher,
  parsePromQLStyleMatcher,
  parsePromQLStyleMatcherLoose,
  parsePromQLStyleMatcherLooseSafe,
  parseQueryParamMatchers,
  quoteWithEscape,
  quoteWithEscapeIfRequired,
  unquoteIfRequired,
  unquoteWithUnescape,
} from './matchers';

describe('Unified Alerting matchers', () => {
  describe('getMatcherQueryParams tests', () => {
    it('Should create an entry for each label', () => {
      const params = getMatcherQueryParams({ foo: 'bar', alertname: 'TestData - No data', rule_uid: 'YNZBpGJnk' });

      const matcherParams = params.getAll('matcher');

      expect(matcherParams).toHaveLength(3);
      expect(matcherParams).toContain('foo=bar');
      expect(matcherParams).toContain('alertname=TestData - No data');
      expect(matcherParams).toContain('rule_uid=YNZBpGJnk');
    });
  });

  describe('parseQueryParamMatchers tests', () => {
    it('Should create a matcher for each unique label-expression pair', () => {
      const matchers = parseQueryParamMatchers(['alertname=TestData 1', 'rule_uid=YNZBpGJnk']);

      expect(matchers).toHaveLength(2);
      expect(matchers[0].name).toBe('alertname');
      expect(matchers[0].value).toBe('TestData 1');
      expect(matchers[1].name).toBe('rule_uid');
      expect(matchers[1].value).toBe('YNZBpGJnk');
    });

    it('Should create one matcher, using the first occurrence when duplicated labels exists', () => {
      const matchers = parseQueryParamMatchers(['alertname=TestData 1', 'alertname=TestData 2']);

      expect(matchers).toHaveLength(1);
      expect(matchers[0].name).toBe('alertname');
      expect(matchers[0].value).toBe('TestData 1');
    });
  });

  describe('normalizeMatchers', () => {
    const eq = MatcherOperator.equal;
    const neq = MatcherOperator.notEqual;

    it('should work for object_matchers', () => {
      const route: Route = { object_matchers: [['foo', eq, 'bar']] };
      expect(normalizeMatchers(route)).toEqual([['foo', eq, 'bar']]);
    });
    it('should work for matchers', () => {
      const route: Route = { matchers: ['foo=bar', 'foo!=bar', 'foo=~bar', 'foo!~bar'] };
      expect(normalizeMatchers(route)).toEqual([
        ['foo', MatcherOperator.equal, 'bar'],
        ['foo', MatcherOperator.notEqual, 'bar'],
        ['foo', MatcherOperator.regex, 'bar'],
        ['foo', MatcherOperator.notRegex, 'bar'],
      ]);
    });
    it('should work for match and match_re', () => {
      const route: Route = { match: { foo: 'bar' }, match_re: { foo: 'bar' } };
      expect(normalizeMatchers(route)).toEqual([
        ['foo', MatcherOperator.regex, 'bar'],
        ['foo', MatcherOperator.equal, 'bar'],
      ]);
    });
    it('should work with PromQL style matchers', () => {
      const route: Route = {
        matchers: ['{ foo=bar, baz!=qux }'],
      };
      expect(normalizeMatchers(route)).toEqual([
        ['foo', eq, 'bar'],
        ['baz', neq, 'qux'],
      ]);
    });
  });
});

describe('parseMatcher', () => {
  it('should be able to parse a simple matcher', () => {
    expect(parseMatcher('foo=bar')).toStrictEqual({ name: 'foo', value: 'bar', isRegex: false, isEqual: true });
  });
  it('should throw when parsing PromQL-style matcher', () => {
    expect(() => parseMatcher('{ foo=bar }')).toThrow();
  });
});

describe('quoteWithEscape', () => {
  const samples: string[][] = [
    ['bar', '"bar"'],
    ['b"ar"', '"b\\"ar\\""'],
    ['b\\ar\\', '"b\\\\ar\\\\"'],
    ['wa{r}ni$ng!', '"wa{r}ni$ng!"'],
  ];

  it.each(samples)('should escape and quote %s to %s', (raw, quoted) => {
    const quotedMatcher = quoteWithEscape(raw);
    expect(quotedMatcher).toBe(quoted);
  });
});

describe('unquoteWithUnescape', () => {
  const samples: string[][] = [
    ['bar', 'bar'],
    ['"bar"', 'bar'],
    ['"b\\"ar\\""', 'b"ar"'],
    ['"b\\\\ar\\\\"', 'b\\ar\\'],
    ['"wa{r}ni$ng!"', 'wa{r}ni$ng!'],
  ];

  it.each(samples)('should unquote and unescape %s to %s', (quoted, raw) => {
    const unquotedMatcher = unquoteWithUnescape(quoted);
    expect(unquotedMatcher).toBe(raw);
  });

  it('should not unescape unquoted string', () => {
    const unquoted = unquoteWithUnescape('un\\"quo\\\\ted');
    expect(unquoted).toBe('un\\"quo\\\\ted');
  });
});

describe('unquoteIfRequired', () => {
  it('should unquote strings with no special character', () => {
    expect(unquoteIfRequired('"test"')).toBe('test');
  });

  it('should not unquote strings with special character', () => {
    expect(unquoteIfRequired('"test this"')).toBe('"test this"');
  });
});

describe('isPromQLStyleMatcher', () => {
  it('should detect promQL style matcher', () => {
    expect(isPromQLStyleMatcher('{ foo=bar }')).toBe(true);
    expect(isPromQLStyleMatcher('foo=bar')).toBe(false);
  });
});

describe('matcherToObjectMatcher', () => {
  test.each([
    { matcher: { name: 'foo', value: 'bar', isRegex: false, isEqual: true }, expected: ['foo', '=', 'bar'] },
    { matcher: { name: 'foo', value: 'bar', isRegex: true, isEqual: true }, expected: ['foo', '=~', 'bar'] },
    { matcher: { name: 'foo', value: 'bar', isRegex: true, isEqual: false }, expected: ['foo', '!~', 'bar'] },
    { matcher: { name: 'foo', value: 'bar', isRegex: false, isEqual: false }, expected: ['foo', '!=', 'bar'] },
  ])('.matcherToObjectMatcher($matcher)', ({ matcher, expected }) => {
    expect(matcherToObjectMatcher(matcher)).toStrictEqual(expected);
  });
});

describe('parsePromQLStyleMatcher', () => {
  it('should decode PromQL style matcher', () => {
    expect(parsePromQLStyleMatcher('{ foo="bar"}')).toStrictEqual([
      {
        name: 'foo',
        value: 'bar',
        isEqual: true,
        isRegex: false,
      },
    ]);
  });

  it('should split only on comma when not used as a label key or value', () => {
    expect(parsePromQLStyleMatcher('{ "key1,key2"="value1,value2"}')).toStrictEqual([
      {
        name: 'key1,key2',
        value: 'value1,value2',
        isEqual: true,
        isRegex: false,
      },
    ]);
  });

  it('should remove empty matchers from array', () => {
    expect(parsePromQLStyleMatcher('{ foo=bar, }')).toStrictEqual([
      { name: 'foo', value: 'bar', isEqual: true, isRegex: false },
    ]);
  });

  it('should throw when not using correct syntax', () => {
    expect(() => parsePromQLStyleMatcher('foo="bar"')).toThrow();
  });

  it('should only encode matchers if the label key contains reserved characters', () => {
    expect(quoteWithEscapeIfRequired('foo')).toBe('foo');
    expect(quoteWithEscapeIfRequired('foo bar')).toBe('"foo bar"');
    expect(quoteWithEscapeIfRequired('foo{}bar')).toBe('"foo{}bar"');
    expect(quoteWithEscapeIfRequired('foo\\bar')).toBe('"foo\\\\bar"');
  });

  it('should properly encode a matcher field', () => {
    expect(encodeMatcher({ name: 'foo', operator: MatcherOperator.equal, value: 'baz' })).toBe('foo="baz"');
    expect(encodeMatcher({ name: 'foo bar', operator: MatcherOperator.equal, value: 'baz' })).toBe('"foo bar"="baz"');
    expect(encodeMatcher({ name: 'foo{}bar', operator: MatcherOperator.equal, value: 'baz qux' })).toBe(
      '"foo{}bar"="baz qux"'
    );
  });
});

describe('parsePromQLStyleMatcherLooseSafe', () => {
  it('should parse all operators', () => {
    expect(parsePromQLStyleMatcherLooseSafe('foo=bar, bar=~ba.+, severity!=warning, email!~@grafana.com')).toEqual<
      Matcher[]
    >([
      { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
      { name: 'bar', value: 'ba.+', isEqual: true, isRegex: true },
      { name: 'severity', value: 'warning', isRegex: false, isEqual: false },
      { name: 'email', value: '@grafana.com', isRegex: true, isEqual: false },
    ]);
  });

  it('should parse with spaces and brackets', () => {
    expect(parsePromQLStyleMatcherLooseSafe('{ foo=bar }')).toEqual<Matcher[]>([
      {
        name: 'foo',
        value: 'bar',
        isRegex: false,
        isEqual: true,
      },
    ]);
  });

  it('should parse with spaces in the value', () => {
    expect(parsePromQLStyleMatcherLooseSafe('foo=bar bazz')).toEqual<Matcher[]>([
      {
        name: 'foo',
        value: 'bar bazz',
        isRegex: false,
        isEqual: true,
      },
    ]);
  });

  it('should return nothing for invalid operator', () => {
    expect(parsePromQLStyleMatcherLooseSafe('foo=!bar')).toEqual([
      {
        name: 'foo',
        value: '!bar',
        isRegex: false,
        isEqual: true,
      },
    ]);
  });

  it('should parse matchers with or without quotes', () => {
    expect(parsePromQLStyleMatcherLooseSafe('foo="bar",bar=bazz')).toEqual<Matcher[]>([
      { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
      { name: 'bar', value: 'bazz', isEqual: true, isRegex: false },
    ]);
  });

  it('should parse matchers for key with special characters', () => {
    expect(parsePromQLStyleMatcherLooseSafe('foo.bar-baz="bar",baz-bar.foo=bazz')).toEqual<Matcher[]>([
      { name: 'foo.bar-baz', value: 'bar', isRegex: false, isEqual: true },
      { name: 'baz-bar.foo', value: 'bazz', isEqual: true, isRegex: false },
    ]);
  });
});

describe('parsePromQLStyleMatcherLoose', () => {
  it('should throw on invalid matcher', () => {
    expect(() => {
      parsePromQLStyleMatcherLoose('foo');
    }).toThrow();

    expect(() => {
      parsePromQLStyleMatcherLoose('foo;bar');
    }).toThrow();
  });

  it('should return empty array for empty input', () => {
    expect(parsePromQLStyleMatcherLoose('')).toStrictEqual([]);
  });

  it('should also accept { } syntax', () => {
    expect(parsePromQLStyleMatcherLoose('{ foo=bar, bar=baz }')).toStrictEqual([
      { isEqual: true, isRegex: false, name: 'foo', value: 'bar' },
      { isEqual: true, isRegex: false, name: 'bar', value: 'baz' },
    ]);
  });
});

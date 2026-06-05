import { ExpressionOperator, comparableValue, makeComparator, parseExpression } from './filterExpression';

describe('comparableValue', () => {
  it('parses integers', () => {
    expect(comparableValue('42')).toBe(42);
  });

  it('parses floats', () => {
    expect(comparableValue('3.14')).toBe(3.14);
  });

  it('parses true as boolean', () => {
    expect(comparableValue('true')).toBe(true);
  });

  it('parses false as boolean', () => {
    expect(comparableValue('false')).toBe(false);
  });

  it('parses boolean case-insensitively', () => {
    expect(comparableValue('TRUE')).toBe(true);
    expect(comparableValue('FALSE')).toBe(false);
  });

  it('parses ISO date strings as a numeric timestamp', () => {
    const result = comparableValue('2024-01-15');
    expect(typeof result).toBe('number');
    expect(new Date(result as number).getFullYear()).toBe(2024);
  });

  it('parses slash-format date strings as a numeric timestamp', () => {
    const result = comparableValue('2024/01/15');
    expect(typeof result).toBe('number');
    expect(new Date(result as number).getFullYear()).toBe(2024);
  });

  it('returns a numeric timestamp for a valid ISO date string', () => {
    const result = comparableValue('2024-01-15');
    expect(typeof result).toBe('number');
    expect(result).toBe(new Date('2024-01-15').getTime());
  });

  it('returns plain strings as-is', () => {
    expect(comparableValue('hello')).toBe('hello');
  });

  it('trims surrounding whitespace', () => {
    expect(comparableValue('  42  ')).toBe(42);
  });

  it('strips backslashes', () => {
    expect(comparableValue('hel\\lo')).toBe('hello');
  });
});

describe('makeComparator', () => {
  describe(ExpressionOperator.EQ, () => {
    it('returns true when values are equal', () => {
      expect(makeComparator(ExpressionOperator.EQ, 20)(20)).toBe(true);
    });
    it('returns false when values differ', () => {
      expect(makeComparator(ExpressionOperator.EQ, 20)(10)).toBe(false);
    });
  });

  describe(ExpressionOperator.DOUBLE_EQ, () => {
    it('returns true when values are equal', () => {
      expect(makeComparator(ExpressionOperator.DOUBLE_EQ, 20)(20)).toBe(true);
    });
    it('returns false when values differ', () => {
      expect(makeComparator(ExpressionOperator.DOUBLE_EQ, 20)(10)).toBe(false);
    });
  });

  describe(ExpressionOperator.STRICT_EQ, () => {
    it('returns true when values are equal', () => {
      expect(makeComparator(ExpressionOperator.STRICT_EQ, 20)(20)).toBe(true);
    });
    it('returns false when values differ', () => {
      expect(makeComparator(ExpressionOperator.STRICT_EQ, 20)(10)).toBe(false);
    });
  });

  describe(ExpressionOperator.NOT_EQ, () => {
    it('returns true when values differ', () => {
      expect(makeComparator(ExpressionOperator.NOT_EQ, 20)(10)).toBe(true);
    });
    it('returns false when values are equal', () => {
      expect(makeComparator(ExpressionOperator.NOT_EQ, 20)(20)).toBe(false);
    });
  });

  describe(ExpressionOperator.STRICT_NOT_EQ, () => {
    it('returns true when values differ', () => {
      expect(makeComparator(ExpressionOperator.STRICT_NOT_EQ, 20)(10)).toBe(true);
    });
    it('returns false when values are equal', () => {
      expect(makeComparator(ExpressionOperator.STRICT_NOT_EQ, 20)(20)).toBe(false);
    });
  });

  describe(ExpressionOperator.GT, () => {
    it('returns true when value is strictly greater', () => {
      expect(makeComparator(ExpressionOperator.GT, 20)(21)).toBe(true);
    });
    it('returns false when value is equal', () => {
      expect(makeComparator(ExpressionOperator.GT, 20)(20)).toBe(false);
    });
    it('returns false when value is less', () => {
      expect(makeComparator(ExpressionOperator.GT, 20)(19)).toBe(false);
    });
  });

  describe(ExpressionOperator.GTE, () => {
    it('returns true when value is greater', () => {
      expect(makeComparator(ExpressionOperator.GTE, 20)(21)).toBe(true);
    });
    it('returns true when value is equal', () => {
      expect(makeComparator(ExpressionOperator.GTE, 20)(20)).toBe(true);
    });
    it('returns false when value is less', () => {
      expect(makeComparator(ExpressionOperator.GTE, 20)(19)).toBe(false);
    });
  });

  describe(ExpressionOperator.LT, () => {
    it('returns true when value is strictly less', () => {
      expect(makeComparator(ExpressionOperator.LT, 20)(19)).toBe(true);
    });
    it('returns false when value is equal', () => {
      expect(makeComparator(ExpressionOperator.LT, 20)(20)).toBe(false);
    });
    it('returns false when value is greater', () => {
      expect(makeComparator(ExpressionOperator.LT, 20)(21)).toBe(false);
    });
  });

  describe(ExpressionOperator.LTE, () => {
    it('returns true when value is less', () => {
      expect(makeComparator(ExpressionOperator.LTE, 20)(19)).toBe(true);
    });
    it('returns true when value is equal', () => {
      expect(makeComparator(ExpressionOperator.LTE, 20)(20)).toBe(true);
    });
    it('returns false when value is greater', () => {
      expect(makeComparator(ExpressionOperator.LTE, 20)(21)).toBe(false);
    });
  });

  it('returns a non-matching predicate for an unknown operator', () => {
    expect(makeComparator('??', 20)(20)).toBe(false);
  });
});

describe('parseExpression', () => {
  describe('string RHS quoting', () => {
    it('matches double-quoted string RHS', () => {
      expect(parseExpression('$ === "foo"')!('foo')).toBe(true);
      expect(parseExpression('$ === "foo"')!('bar')).toBe(false);
    });

    it('matches single-quoted string RHS', () => {
      expect(parseExpression("$ === 'foo'")!('foo')).toBe(true);
      expect(parseExpression("$ === 'foo'")!('bar')).toBe(false);
    });

    it('matches backtick-quoted string RHS', () => {
      expect(parseExpression('$ === `foo`')!('foo')).toBe(true);
      expect(parseExpression('$ === `foo`')!('bar')).toBe(false);
    });
  });

  describe('boolean and date RHS', () => {
    it('matches boolean true RHS', () => {
      expect(parseExpression('$ = true')!(true)).toBe(true);
      expect(parseExpression('$ = true')!(false)).toBe(false);
    });

    it('matches boolean false RHS', () => {
      expect(parseExpression('$ = false')!(false)).toBe(true);
      expect(parseExpression('$ = false')!(true)).toBe(false);
    });

    it('matches date string RHS', () => {
      const result = parseExpression('$ = 2024-01-01');
      const match = comparableValue('2024-01-01');
      const nonMatch = comparableValue('2024-06-15');
      expect(result!(match)).toBe(true);
      expect(result!(nonMatch)).toBe(false);
    });
  });

  describe('compound expressions', () => {
    it('&& requires all clauses to match', () => {
      const pred = parseExpression('$ > 10 && $ < 20')!;
      expect(pred(15)).toBe(true);
      expect(pred(5)).toBe(false);
      expect(pred(25)).toBe(false);
    });

    it('pure || matches any clause', () => {
      const pred = parseExpression('$ = 1 || $ = 10')!;
      expect(pred(1)).toBe(true);
      expect(pred(10)).toBe(true);
      expect(pred(5)).toBe(false);
    });

    it('mixed && and || respects AND-before-OR precedence', () => {
      const pred = parseExpression('$ > 5 && $ < 10 || $ > 20')!;
      expect(pred(7)).toBe(true);
      expect(pred(25)).toBe(true);
      expect(pred(3)).toBe(false);
      expect(pred(15)).toBe(false);
    });
  });

  describe('DOUBLE_EQ operator via expression syntax', () => {
    it('parses $ == 20 and matches equal values', () => {
      const pred = parseExpression('$ == 20');
      expect(pred).not.toBeNull();
      expect(pred!(20)).toBe(true);
      expect(pred!(10)).toBe(false);
    });

    it('parses $ == 20 and does not match unequal values', () => {
      const pred = parseExpression('$ == 20');
      expect(pred).not.toBeNull();
      expect(pred!(30)).toBe(false);
    });
  });

  describe('invalid expressions', () => {
    it('"$ ===" parses as == against the string "=" (greedy operator match)', () => {
      const pred = parseExpression('$ ===');
      expect(pred).not.toBeNull();
      expect(pred!('=')).toBe(true);
      expect(pred!(42)).toBe(false);
    });

    it('returns null for a clause that does not match CLAUSE_REGEX', () => {
      expect(parseExpression('not a valid clause')).toBeNull();
    });

    it('does not evaluate arbitrary function expressions', () => {
      expect(parseExpression('(function() { return true; })()')).toBeNull();
    });

    it('does not evaluate arrow function expressions', () => {
      expect(parseExpression('(() => true)()')).toBeNull();
    });

    it('does not evaluate arbitrary JS method calls', () => {
      expect(parseExpression('Math.random() > 0')).toBeNull();
    });

    it('returns null when any clause in an && group is invalid', () => {
      expect(parseExpression('$ > 10 && invalid')).toBeNull();
    });

    it('returns null when any OR group is invalid', () => {
      expect(parseExpression('$ > 10 || invalid')).toBeNull();
    });
  });
});

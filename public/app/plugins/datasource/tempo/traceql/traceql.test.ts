import {
  languageDefinition,
  traceqlGrammar,
  operators,
  keywordOperators,
  stringOperators,
  numberOperators,
  intrinsics,
  scopes,
  enumIntrinsics,
} from './traceql';

describe('TraceQL grammar', () => {
  describe('Language definition', () => {
    it('should include all required keywords', () => {
      const { keywords } = languageDefinition.def.language;
      expect(keywords).toContain('with');
      expect(keywords).toContain('span');
      expect(keywords).toContain('resource');
      expect(keywords).toContain('duration');
      expect(keywords).toContain('status');
    });

    it('should include with clause keywords and parameters', () => {
      const { withClauseKeywords, withParameters } = languageDefinition.def.language;
      expect(withClauseKeywords).toContain('with');
      expect(withParameters).toContain('most_recent');
    });
  });

  describe('Operators', () => {
    it('should include all comparison operators', () => {
      expect(operators).toContain('=');
      expect(operators).toContain('!=');
      expect(operators).toContain('>');
      expect(operators).toContain('<');
      expect(operators).toContain('>=');
      expect(operators).toContain('<=');
      expect(operators).toContain('=~');
      expect(operators).toContain('!~');
    });

    it('should categorize operators correctly', () => {
      expect(keywordOperators).toEqual(['=', '!=']);
      expect(stringOperators).toEqual(['=', '!=', '=~', '!~']);
      expect(numberOperators).toEqual(['=', '!=', '>', '<', '>=', '<=']);
    });
  });

  describe('Intrinsics and scopes', () => {
    it('should include all intrinsics', () => {
      expect(intrinsics).toContain('duration');
      expect(intrinsics).toContain('name');
      expect(intrinsics).toContain('status');
      expect(intrinsics).toContain('span:duration');
      expect(intrinsics).toContain('trace:id');
    });

    it('should include all scopes', () => {
      expect(scopes).toContain('event');
      expect(scopes).toContain('instrumentation');
      expect(scopes).toContain('link');
      expect(scopes).toContain('resource');
      expect(scopes).toContain('span');
    });

    it('should identify enum intrinsics', () => {
      expect(enumIntrinsics).toContain('kind');
      expect(enumIntrinsics).toContain('span:kind');
      expect(enumIntrinsics).toContain('status');
      expect(enumIntrinsics).toContain('span:status');
    });
  });

  describe('TraceQL patterns', () => {
    it('should match span-set patterns', () => {
      const spanSetRule = traceqlGrammar['span-set'];
      expect(spanSetRule).toBeDefined();
      expect(spanSetRule.pattern).toBeDefined();
      const spanSetPattern = spanSetRule.pattern as RegExp;
      expect(spanSetPattern.test('{span.name="foo"}')).toBe(true);
      expect(spanSetPattern.test('{resource.service.name="bar"}')).toBe(true);
      expect(spanSetPattern.test('{duration>1s}')).toBe(true);
    });

    it('should match with-clause patterns', () => {
      const withClauseRule = traceqlGrammar['with-clause'];
      expect(withClauseRule).toBeDefined();
      expect(withClauseRule.pattern).toBeDefined();
      const withClausePattern = withClauseRule.pattern as RegExp;
      expect(withClausePattern.test('with (most_recent=true)')).toBe(true);
      expect(withClausePattern.test('with (most_recent=false)')).toBe(true);
      expect(withClausePattern.test('with(most_recent=true)')).toBe(true);
      expect(withClausePattern.test('with (most_recent = true)')).toBe(true);
    });

    it('should match comment patterns', () => {
      const commentRule = traceqlGrammar.comment;
      expect(commentRule).toBeDefined();
      expect(commentRule.pattern).toBeDefined();
      const commentPattern = commentRule.pattern as RegExp;
      expect(commentPattern.test('// This is a comment')).toBe(true);
      expect(commentPattern.test('//Another comment')).toBe(true);
    });

    it('should match number patterns', () => {
      const numberRule = traceqlGrammar.number;
      expect(numberRule).toBeDefined();
      const numberPattern = numberRule as RegExp;
      expect(numberPattern.test('123')).toBe(true);
      expect(numberPattern.test('123.45')).toBe(true);
      expect(numberPattern.test('-123')).toBe(true);
      expect(numberPattern.test('1.23e10')).toBe(true);
    });

    it('should match operator patterns', () => {
      const operatorRule = traceqlGrammar.operator;
      expect(operatorRule).toBeDefined();
      const operatorPattern = operatorRule as RegExp;
      expect(operatorPattern.test('=')).toBe(true);
      expect(operatorPattern.test('!=')).toBe(true);
      expect(operatorPattern.test('>')).toBe(true);
      expect(operatorPattern.test('<')).toBe(true);
      expect(operatorPattern.test('>=')).toBe(true);
      expect(operatorPattern.test('<=')).toBe(true);
    });
  });

  describe('TraceQL query syntax', () => {
    const testCases = [
      // Empty query
      {
        name: 'empty query',
        query: '{}',
        shouldMatch: true,
      },
      // Basic queries
      {
        name: 'basic span query with string equality',
        query: '{ span.name="test" }',
        shouldMatch: true,
      },
      {
        name: 'basic span query with string inequality',
        query: '{ span.name!="test" }',
        shouldMatch: true,
      },
      {
        name: 'basic span query with regex match',
        query: '{ span.name=~"test" }',
        shouldMatch: true,
      },
      {
        name: 'basic span query with regex mismatch',
        query: '{ span.name!~"test" }',
        shouldMatch: true,
      },
      {
        name: 'basic span query with number equality',
        query: '{span.duration=10}',
        shouldMatch: true,
      },
      {
        name: 'basic span query with boolean',
        query: '{span.flags.sampled=true}',
        shouldMatch: true,
      },
      {
        name: 'resource query',
        query: '{resource.service.name="my-service"}',
        shouldMatch: true,
      },
      {
        name: 'duration query',
        query: '{duration>1s}',
        shouldMatch: true,
      },
      // Structural operators
      {
        name: 'structural operator child query',
        query: '{span.name="parent"} > {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'structural operator parent query',
        query: '{span.name="parent"} < {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'structural operator descendant query',
        query: '{span.name="parent"} >> {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'structural operator ancestor query',
        query: '{span.name="parent"} << {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'structural operator sibling query',
        query: '{span.name="parent"} ~ {span.name="child"}',
        shouldMatch: true,
      },
      // Union structure operators
      {
        name: 'union structural operator child query',
        query: '{span.name="parent"} &> {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'union structural operator parent query',
        query: '{span.name="parent"} &< {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'union structural operator descendant query',
        query: '{span.name="parent"} &>> {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'union structural operator ancestor query',
        query: '{span.name="parent"} &<< {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'union structural operator sibling query',
        query: '{span.name="parent"} &~ {span.name="child"}',
        shouldMatch: true,
      },
      // Negated structure operators
      {
        name: 'negated structural operator child query',
        query: '{span.name="parent"} !> {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'negated structural operator parent query',
        query: '{span.name="parent"} !< {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'negated structural operator descendant query',
        query: '{span.name="parent"} !>> {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'negated structural operator ancestor query',
        query: '{span.name="parent"} !<< {span.name="child"}',
        shouldMatch: true,
      },
      {
        name: 'negated structural operator sibling query',
        query: '{span.name="parent"} !~ {span.name="child"}',
        shouldMatch: true,
      }, // Comments
      {
        name: 'query with comment',
        query: '// Find slow requests\n{duration>1s}',
        shouldMatch: true,
      },
      // Query hint queries
      {
        name: 'query hint - most_recent true',
        query: '{span.name="test"} with (most_recent=true)',
        shouldMatch: true,
      },
      {
        name: 'query hint - most_recent false',
        query: '{span.name="test"} with (most_recent=false)',
        shouldMatch: true,
      },
      {
        name: 'query hint - no spaces',
        query: '{span.name="test"} with(most_recent=true)',
        shouldMatch: true,
      },
      {
        name: 'query hint - extra spaces',
        query: '{span.name="test"} with ( most_recent = true )',
        shouldMatch: true,
      },
      // Test enum intrinsics with valid values
      {
        name: 'enum intrinsic - kind with server value',
        query: '{kind=server}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - kind with client value',
        query: '{kind=client}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - kind with producer value',
        query: '{kind=producer}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - kind with consumer value',
        query: '{kind=consumer}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - kind with internal value',
        query: '{kind=internal}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - status with ok value',
        query: '{status=ok}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - status with error value',
        query: '{status=error}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - status with unset value',
        query: '{status=unset}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - span:kind with server value',
        query: '{span:kind=server}',
        shouldMatch: true,
      },
      {
        name: 'enum intrinsic - span:status with error value',
        query: '{span:status=error}',
        shouldMatch: true,
      },
      // Complex queries
      {
        name: 'complex query with with clause',
        query: '{span.http.status_code=200 && span.name="GET /api"} | select(span.duration) with (most_recent=true)',
        shouldMatch: true,
      },
      {
        name: 'aggregation with with clause',
        query: '{span.service.name="frontend"} | avg(duration) with (most_recent=false)',
        shouldMatch: true,
      },
    ];

    testCases.forEach(({ name, query, shouldMatch }) => {
      it(`should ${shouldMatch ? 'match' : 'not match'} ${name}`, () => {
        const grammar = traceqlGrammar;
        const spanSetPattern = grammar['span-set']?.pattern as RegExp;
        const withClausePattern = grammar['with-clause']?.pattern as RegExp;
        const commentPattern = grammar.comment?.pattern as RegExp;

        const spanSetMatches = spanSetPattern ? (query.match(spanSetPattern) || []).length > 0 : false;
        const withClauseMatches = withClausePattern ? (query.match(withClausePattern) || []).length > 0 : false;
        const commentMatches = commentPattern ? (query.match(commentPattern) || []).length > 0 : false;

        const hasAnyMatch = spanSetMatches || withClauseMatches || commentMatches;

        if (shouldMatch) {
          expect(hasAnyMatch).toBe(true);
        } else {
          expect(hasAnyMatch).toBe(false);
        }
      });
    });
  });

  describe('With clause validation', () => {
    it('should validate with clause parameter names', () => {
      const grammar = traceqlGrammar;
      const withClause = grammar['with-clause'];
      expect(withClause).toBeDefined();
      expect(withClause.inside).toBeDefined();

      const parameterNameRule = withClause.inside['parameter-name'];
      expect(parameterNameRule).toBeDefined();
      const parameterNamePattern = parameterNameRule.pattern as RegExp;

      expect(parameterNamePattern.test('most_recent=')).toBe(true);
      expect(parameterNamePattern.test('invalid_param=')).toBe(true);
      expect(parameterNamePattern.test('123invalid=')).toBe(false);
    });

    it('should validate with clause parameter values', () => {
      const grammar = traceqlGrammar;
      const withClause = grammar['with-clause'];
      expect(withClause).toBeDefined();
      expect(withClause.inside).toBeDefined();

      const parameterValueRule = withClause.inside['parameter-value'];
      expect(parameterValueRule).toBeDefined();
      const parameterValuePattern = parameterValueRule.pattern as RegExp;

      expect(parameterValuePattern.test('true')).toBe(true);
      expect(parameterValuePattern.test('false')).toBe(true);
      expect(parameterValuePattern.test('"string_value"')).toBe(true);
      expect(parameterValuePattern.test("'string_value'")).toBe(true);
      expect(parameterValuePattern.test('123')).toBe(true);
      expect(parameterValuePattern.test('123.45')).toBe(true);
    });

    it('should validate with clause keyword', () => {
      const grammar = traceqlGrammar;
      const withClause = grammar['with-clause'];
      expect(withClause).toBeDefined();
      expect(withClause.inside).toBeDefined();

      const keywordRule = withClause.inside['with-keyword'];
      expect(keywordRule).toBeDefined();
      const keywordPattern = keywordRule.pattern as RegExp;

      expect(keywordPattern.test('with')).toBe(true);
      expect(keywordPattern.test('WITH')).toBe(false); // Case sensitive
      expect(keywordPattern.test('width')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple with clauses (invalid but should not crash)', () => {
      const query = '{span.name="test"} with (most_recent=true) with (other=false)';
      const grammar = traceqlGrammar;
      const withClausePattern = grammar['with-clause']?.pattern as RegExp;

      if (withClausePattern) {
        // Use global flag to match all occurrences
        const globalPattern = new RegExp(withClausePattern.source, 'g');
        const matches = query.match(globalPattern);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(2);
      }
    });

    it('should handle with clause without parameters', () => {
      const query = '{span.name="test"} with ()';
      const grammar = traceqlGrammar;
      const withClausePattern = grammar['with-clause']?.pattern as RegExp;

      if (withClausePattern) {
        const matches = query.match(withClausePattern);
        expect(matches).not.toBeNull();
      }
    });
  });
});

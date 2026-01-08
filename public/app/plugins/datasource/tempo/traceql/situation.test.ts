import { getSituation, SituationType } from './situation';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

interface SituationTest {
  query: string;
  cursorPos: number;
  expected: SituationType;
}

describe('situation', () => {
  const tests: SituationTest[] = [
    {
      query: '{}',
      cursorPos: 1,
      expected: { type: 'SPANSET_EMPTY' },
    },
    {
      query: '{.}',
      cursorPos: 2,
      expected: { type: 'SPANSET_ONLY_DOT' },
    },
    {
      query: '{.foo}',
      cursorPos: 5,
      expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: '' },
    },
    {
      query: '{.foo }',
      cursorPos: 6,
      expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
    },
    {
      query: '{span.}',
      cursorPos: 6,
      expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: 'span' },
    },
    {
      query: '{span.foo }',
      cursorPos: 10,
      expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
    },
    {
      query: '{span.foo = }',
      cursorPos: 12,
      expected: { type: 'SPANSET_IN_VALUE', tagName: 'span.foo', betweenQuotes: false },
    },
    {
      query: '{span.foo = "val" }',
      cursorPos: 18,
      expected: { type: 'SPANFIELD_COMBINING_OPERATORS' },
    },
    {
      query: '{span.foo = 200 }',
      cursorPos: 16,
      expected: { type: 'SPANFIELD_COMBINING_OPERATORS' },
    },
    {
      query: '{span.foo = "val" && }',
      cursorPos: 21,
      expected: { type: 'SPANSET_EMPTY' },
    },
    {
      query: '{span.foo = "val" && resource.}',
      cursorPos: 30,
      expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: 'resource' },
    },
    {
      query: '{ .sla && span.http.status_code && span.http.status_code  = 200 }',
      cursorPos: 57,
      expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
    },
    // Query hint situations
    {
      query: '{.foo=300} with(',
      cursorPos: 16,
      expected: { type: 'QUERY_HINT_NAME' },
    },
    {
      query: '{.foo=300} with( ',
      cursorPos: 17,
      expected: { type: 'QUERY_HINT_NAME' },
    },
    {
      query: '{.foo=300} with(most_recent=',
      cursorPos: 28,
      expected: { type: 'QUERY_HINT_VALUE' },
    },
    {
      query: '{.foo=300} with(most_recent= ',
      cursorPos: 29,
      expected: { type: 'QUERY_HINT_VALUE' },
    },
    {
      query: '{.foo=300} with(most_recent=true',
      cursorPos: 32,
      expected: { type: 'QUERY_HINT_VALUE' },
    },
    {
      query: '{} with(',
      cursorPos: 8,
      expected: { type: 'QUERY_HINT_NAME' },
    },
    {
      query: '{} with(most_recent=',
      cursorPos: 20,
      expected: { type: 'QUERY_HINT_VALUE' },
    },
  ];

  tests.forEach((test) => {
    it(`${test.query} at ${test.cursorPos} is ${test.expected.type}`, async () => {
      const sit = getSituation(test.query, test.cursorPos);
      expect(sit).toEqual({ ...test.expected, query: test.query });
    });
  });
});

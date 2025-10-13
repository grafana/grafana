import { parser } from '@grafana/lezer-logql';

import { validateQuery } from './validation';

describe('Monaco Query Validation', () => {
  test('Identifies empty queries as valid', () => {
    expect(validateQuery('', '', [], parser)).toBeFalsy();
  });

  test('Identifies valid queries', () => {
    const query = '{place="luna"}';
    expect(validateQuery(query, query, [], parser)).toBeFalsy();
  });

  test('Validates logs queries', () => {
    let query = '{place="incomplete"';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 20,
        endLineNumber: 1,
        error: '{place="incomplete"',
        startColumn: 1,
        startLineNumber: 1,
      },
    ]);

    query = '{place="luna"} | notaparser';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 28,
        endLineNumber: 1,
        error: 'notaparser',
        startColumn: 18,
        startLineNumber: 1,
      },
    ]);

    query = '{place="luna"} | logfmt |';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 26,
        endLineNumber: 1,
        error: '|',
        startColumn: 25,
        startLineNumber: 1,
      },
    ]);
  });

  test('Validates metric queries', () => {
    let query = 'sum(count_over_time({place="luna" | unwrap request_time [5m])) by (level)';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 35,
        endLineNumber: 1,
        error: '{place="luna" ',
        startColumn: 21,
        startLineNumber: 1,
      },
    ]);

    query = 'sum(count_over_time({place="luna"} | unwrap [5m])) by (level)';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 45,
        endLineNumber: 1,
        error: '| unwrap ',
        startColumn: 36,
        startLineNumber: 1,
      },
    ]);

    query = 'sum()';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 5,
        endLineNumber: 1,
        error: '',
        startColumn: 5,
        startLineNumber: 1,
      },
    ]);
  });

  test('Validates multi-line queries', () => {
    const query = `
{place="luna"} 
# this is a comment 
|
unpack fail
|= "a"`;
    const queryLines = query.split('\n');
    expect(validateQuery(query, query, queryLines, parser)).toEqual([
      {
        endColumn: 12,
        endLineNumber: 5,
        error: 'fail',
        startColumn: 8,
        startLineNumber: 5,
      },
    ]);
  });
});

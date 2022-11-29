import { validateQuery } from './validation';

describe('Monaco Query Validation', () => {
  test('Identifies empty queries as valid', () => {
    expect(validateQuery('', [])).toBeFalsy();
  });

  test('Identifies valid queries', () => {
    expect(validateQuery('{place="luna"}', [])).toBeFalsy();
  });

  test('Validates logs queries', () => {
    expect(validateQuery('{place="incomplete"', ['{place="incomplete"'])).toEqual([
      {
        endColumn: 20,
        endLineNumber: 1,
        error: '{place="incomplete"',
        startColumn: 1,
        startLineNumber: 1,
      },
    ]);

    expect(validateQuery('{place="luna"} | notaparser', ['{place="luna"} | notaparser'])).toEqual([
      {
        endColumn: 28,
        endLineNumber: 1,
        error: 'notaparser',
        startColumn: 18,
        startLineNumber: 1,
      },
    ]);

    expect(validateQuery('{place="luna"} | logfmt |', ['{place="luna"} | logfmt |'])).toEqual([
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
    expect(
      validateQuery('sum(count_over_time({place="luna" | unwrap request_time [5m])) by (level)', [
        'sum(count_over_time({ place="luna" | unwrap request_time [5m])) by (level)',
      ])
    ).toEqual([
      {
        endColumn: 35,
        endLineNumber: 1,
        error: '{place="luna" ',
        startColumn: 21,
        startLineNumber: 1,
      },
    ]);

    expect(
      validateQuery('sum(count_over_time({place="luna"} | unwrap [5m])) by (level)', [
        'sum(count_over_time({ place="luna" | unwrap request_time [5m])) by (level)',
      ])
    ).toEqual([
      {
        endColumn: 45,
        endLineNumber: 1,
        error: '| unwrap ',
        startColumn: 36,
        startLineNumber: 1,
      },
    ]);

    expect(validateQuery('sum()', ['sum()'])).toEqual([
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
logfmt fail
|= "a"`;
    const queryLines = query.split('\n');
    expect(validateQuery(query, queryLines)).toEqual([
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

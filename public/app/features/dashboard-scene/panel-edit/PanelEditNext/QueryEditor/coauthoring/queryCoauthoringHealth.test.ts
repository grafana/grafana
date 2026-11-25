import {
  type DataQuery,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';

import { expressionReferences } from './queryCoauthoringDependencies';
import { classifyOptionOutcome, deriveQueryHealth, isQueryBroken } from './queryCoauthoringHealth';

interface HealthQuery extends DataQuery {
  type?: string;
  expression?: string;
  conditions?: Array<{ query: { params: string[] } }>;
}

const expression = (refId: string, text: string, type = 'math'): HealthQuery => ({
  refId,
  datasource: { uid: '__expr__', type: '__expr__' },
  type,
  expression: text,
});
const queries: DataQuery[] = [
  { refId: 'A' },
  { refId: 'B' },
  expression('C', '$A + 1'),
  expression('D', 'C', 'reduce'),
  { refId: 'H', hide: true },
  expression('I', '$H + 1'),
];
const frame = (refId: string, values: Array<number | null>) =>
  toDataFrame({
    refId,
    fields: [{ name: 'value', type: FieldType.number, values }],
  });
const data = (overrides: Partial<PanelData> = {}): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [frame('A', [2]), frame('B', [0]), frame('C', [3]), frame('D', [3]), frame('I', [2])],
  ...overrides,
});

it('derives per-query health without confusing downstream errors with upstream health', () => {
  expect(deriveQueryHealth(queries, data({ errors: [{ refId: 'D', message: 'failed' }] }))).toEqual({
    A: 'ok',
    B: 'no-signal',
    C: 'ok',
    D: 'error',
    H: 'unknown',
    I: 'ok',
  });
});

it.each([undefined, LoadingState.Loading, LoadingState.Streaming])(
  'keeps never-run and %s queries unknown',
  (state) => {
    expect(deriveQueryHealth([{ refId: 'A' }], state ? data({ state }) : undefined)).toEqual({ A: 'unknown' });
  }
);

it('derives no-data for empty, null-only and missing results', () => {
  expect(
    deriveQueryHealth(
      [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }],
      data({ series: [frame('A', []), frame('B', [null])] })
    )
  ).toEqual({ A: 'no-data', B: 'no-data', C: 'no-data' });
});

it('follows transitive upstream failures and does not gate on hidden errors or no-signal', () => {
  const health = deriveQueryHealth(
    queries,
    data({
      errors: [
        { refId: 'A', message: 'failed' },
        { refId: 'H', message: 'hidden' },
      ],
    })
  );
  expect(isQueryBroken('D', queries, health, undefined)).toBe(true);
  expect(isQueryBroken('I', queries, health, undefined)).toBe(false);
  expect(isQueryBroken('B', queries, health, undefined)).toBe(false);
});

it('detects upstream no-data and terminates expression dependency cycles', () => {
  const cyclic = [expression('A', '$B'), expression('B', '$A'), { refId: 'C' }];
  expect(isQueryBroken('A', cyclic, { A: 'ok', B: 'ok', C: 'no-data' }, undefined)).toBe(false);
  expect(isQueryBroken('A', cyclic, { A: 'ok', B: 'no-data', C: 'ok' }, undefined)).toBe(true);
});

it.each([
  ['SELECT A FROM B JOIN `C D` ON B.x = `C D`.x', ['B', 'C D']],
  ["SELECT 'FROM A' AS A FROM B -- JOIN C\n", ['B']],
  ['SELECT * FROM A, B WHERE B.x = A.x', ['A', 'B']],
  ['WITH B AS (SELECT * FROM A) SELECT * FROM B', ['A']],
  ['SELECT * FROM (SELECT * FROM B) q', ['B']],
])('resolves SQL table dependencies in %s', (text, references) => {
  expect(
    expressionReferences(
      expression('SQL', text, 'sql'),
      references.map((refId) => ({ refId })),
      undefined
    )
  ).toEqual(references);
});

it('reads classic condition references and exact math references', () => {
  const condition: HealthQuery = {
    ...expression('C', '', 'classic_conditions'),
    conditions: [{ query: { params: ['A'] } }],
  };
  expect(expressionReferences(condition, queries, undefined)).toEqual(['A']);
  expect(expressionReferences(expression('C', '${With spaces} + $AA'), queries, undefined)).toEqual([
    '${With spaces} + $AA',
    'With spaces',
    'AA',
  ]);
});

it('ignores missing hidden frames but still reports hidden query errors in Option outcomes', () => {
  expect(classifyOptionOutcome(data(), queries, ['H'], undefined).kind).toBe('ok');
  expect(
    classifyOptionOutcome(data({ errors: [{ refId: 'H', message: 'hidden query failed' }] }), queries, ['H'], undefined)
  ).toMatchObject({ kind: 'error', message: 'hidden query failed' });
});

it('takes the worst outcome per changed query and downstream expression, ignoring unrelated errors', () => {
  expect(
    classifyOptionOutcome(
      data({ series: [frame('A', [2]), frame('C', [3])], errors: [{ refId: 'B', message: 'unrelated' }] }),
      queries,
      ['A'],
      undefined
    ).kind
  ).toBe('no-data');
  expect(
    classifyOptionOutcome(data({ errors: [{ refId: 'D', message: 'downstream' }] }), queries, ['A'], undefined)
  ).toMatchObject({ kind: 'error', message: 'downstream' });
  expect(classifyOptionOutcome(data(), queries, ['A', 'B'], undefined).kind).toBe('no-signal');
});

it('retains warning notices even when a different query has no data', () => {
  const warning = frame('A', [2]);
  warning.meta = { notices: [{ severity: 'warning', text: 'partial results' }] };
  expect(
    classifyOptionOutcome(data({ series: [warning] }), [{ refId: 'A' }, { refId: 'B' }], ['A', 'B'], undefined)
  ).toMatchObject({ kind: 'no-data', warnings: ['partial results'] });
});

it('traverses unknown hidden intermediate expressions without treating their own health as a failure', () => {
  const chain = [{ refId: 'A' }, { ...expression('B', '$A'), hide: true }, expression('C', '$B')];
  expect(isQueryBroken('C', chain, { A: 'error', B: 'unknown', C: 'ok' }, undefined)).toBe(true);
  expect(isQueryBroken('C', chain, { A: 'no-data', B: 'unknown', C: 'ok' }, undefined)).toBe(true);
  expect(isQueryBroken('C', chain, { A: 'ok', B: 'unknown', C: 'ok' }, undefined)).toBe(false);
});

it('keeps panel-only errors out of query health without weakening preview failures', () => {
  const panelError = data({ series: [frame('A', [2])], error: { message: 'panel failure' } });
  expect(deriveQueryHealth([{ refId: 'A' }, { refId: 'B' }], panelError)).toEqual({ A: 'ok', B: 'unknown' });
  expect(classifyOptionOutcome(panelError, [{ refId: 'A' }], ['A'], undefined).kind).toBe('error');
});

it('canonicalizes SQL case and punctuation while keeping math case-sensitive and CTEs scoped', () => {
  const source = [{ refId: 'A' }, { refId: 'a' }, { refId: 'B.C' }, { refId: 'Z' }];
  const sql = expression('S', 'WITH Temp AS (SELECT * FROM a) SELECT * FROM TEMP JOIN `b.c` ON 1=1', 'sql');
  expect(expressionReferences(sql, source, undefined)).toEqual(['A', 'a', 'B.C']);
  expect(expressionReferences(expression('M', '$z'), source, undefined)).toEqual(['$z', 'z']);
});

it('shares inherited expression dependencies across broken checks and Option outcomes', () => {
  const inherited: HealthQuery[] = [
    { refId: 'A', datasource: { uid: 'mock' } },
    { refId: 'B', type: 'math', expression: '$A' },
  ];
  const fallback = { uid: '__expr__' };
  expect(isQueryBroken('B', inherited, { A: 'error', B: 'ok' }, fallback)).toBe(true);
  expect(isQueryBroken('B', inherited, { A: 'error', B: 'ok' }, { uid: '-- Mixed --' })).toBe(false);
  expect(
    classifyOptionOutcome(data({ errors: [{ refId: 'B', message: 'dependent' }] }), inherited, ['A'], fallback).kind
  ).toBe('error');
});

it('keeps scoped-error badges distinct from no-data Debug eligibility', () => {
  const chain = [{ refId: 'A' }, expression('B', '$A')];
  expect(isQueryBroken('B', chain, { A: 'no-data', B: 'ok' }, undefined, false)).toBe(false);
  expect(isQueryBroken('B', chain, { A: 'no-data', B: 'ok' }, undefined)).toBe(true);
  expect(isQueryBroken('B', chain, { A: 'error', B: 'ok' }, undefined, false)).toBe(true);
});

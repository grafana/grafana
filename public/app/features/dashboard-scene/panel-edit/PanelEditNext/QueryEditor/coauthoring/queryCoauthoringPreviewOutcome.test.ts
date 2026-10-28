import {
  type DataFrame,
  type DataQuery,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';

import { classifyQueryPreview } from './queryCoauthoringPreviewOutcome';

interface PreviewTarget extends DataQuery {
  expr?: string;
  type?: string;
  expression?: string;
  conditions?: Array<{ query: { params: string[] } }>;
}

const targets: PreviewTarget[] = [
  { refId: 'A', expr: 'rate(http_requests_total[5m])' },
  { refId: 'B', expr: 'up' },
  { refId: 'C', datasource: { uid: '__expr__', type: '__expr__' }, type: 'math', expression: '$A + $B' },
  { refId: 'D', datasource: { uid: '__expr__', type: '__expr__' }, type: 'reduce', expression: 'C' },
  { refId: 'E', datasource: { uid: '__expr__', type: '__expr__' }, type: 'math', expression: '$AA + ${B}' },
];

function numericFrame(refId: string, values: Array<number | null>): DataFrame {
  return toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((_, index) => 1_000 + index) },
      { name: 'Value', type: FieldType.number, values },
    ],
  });
}

function makeData(series: DataFrame[], overrides: Partial<PanelData> = {}): PanelData {
  const timeRange = getDefaultTimeRange();
  return {
    state: LoadingState.Done,
    series,
    timeRange,
    request: {
      requestId: 'preview',
      interval: '1s',
      intervalMs: 1_000,
      scopedVars: {},
      range: timeRange,
      targets,
      startTime: 0,
      timezone: 'utc',
      app: 'dashboard',
    },
    ...overrides,
  };
}

describe('classifyQueryPreview', () => {
  it.each([LoadingState.Loading, LoadingState.Streaming])('prioritizes %s over empty rows and errors', (state) => {
    expect(classifyQueryPreview(makeData([], { state, errors: [{ refId: 'A', message: 'Failed' }] }), 'A')).toEqual({
      kind: 'loading',
    });
  });

  it('classifies an option awaiting its first data as loading', () => {
    expect(classifyQueryPreview(undefined, 'A')).toEqual({ kind: 'loading' });
  });

  it('ignores data and errors from the other query and unrelated expressions', () => {
    const data = makeData([numericFrame('A', [2]), numericFrame('B', [0])], {
      state: LoadingState.Error,
      errors: [
        { refId: 'B', message: 'Other query failed' },
        { refId: 'E', message: 'Unrelated expression failed' },
      ],
    });
    expect(classifyQueryPreview(data, 'A')).toEqual({ kind: 'ok', notices: [] });
  });

  it('does not mistake data from another query for data in the selected option', () => {
    expect(classifyQueryPreview(makeData([numericFrame('B', [2])]), 'A')).toEqual({ kind: 'no-data' });
  });

  it.each(['C', 'D'])('includes errors from dependent expression %s', (refId) => {
    expect(
      classifyQueryPreview(
        makeData([numericFrame('A', [2])], {
          state: LoadingState.Error,
          errors: [{ refId, message: 'Expression divide by zero' }],
        }),
        'A'
      )
    ).toEqual({ kind: 'error', message: 'Expression divide by zero' });
  });

  it('includes bracketed expression references without confusing A with AA', () => {
    const data = makeData([], { errors: [{ refId: 'C', message: 'Bracketed expression failed' }] });
    if (data.request) {
      const expressionTargets: PreviewTarget[] = [
        targets[0],
        {
          refId: 'C',
          datasource: { uid: '__expr__', type: '__expr__' },
          type: 'math',
          expression: '${A} * 2',
        },
      ];
      data.request.targets = expressionTargets;
    }
    expect(classifyQueryPreview(data, 'A')).toEqual({ kind: 'error', message: 'Bracketed expression failed' });
  });

  it('includes classic-condition expressions consuming the edited query', () => {
    const data = makeData([], { errors: [{ refId: 'C', message: 'Condition failed' }] });
    if (data.request) {
      const expressionTargets: PreviewTarget[] = [
        targets[0],
        {
          refId: 'C',
          datasource: { uid: '__expr__', type: '__expr__' },
          type: 'classic_conditions',
          conditions: [{ query: { params: ['A'] } }],
        },
      ];
      data.request.targets = expressionTargets;
    }
    expect(classifyQueryPreview(data, 'A')).toEqual({ kind: 'error', message: 'Condition failed' });
  });

  it('uses the real error message and reserves the generic fallback for a missing message', () => {
    expect(
      classifyQueryPreview(makeData([], { errors: [{ refId: 'A', message: 'Label matcher is invalid' }] }), 'A')
    ).toEqual({ kind: 'error', message: 'Label matcher is invalid' });
    expect(classifyQueryPreview(makeData([], { errors: [{ refId: 'A', message: '' }] }), 'A')).toEqual({
      kind: 'error',
      message: undefined,
    });
  });

  it('shows request-level errors without a refId and supports the legacy error field', () => {
    expect(classifyQueryPreview(makeData([], { errors: [{ message: 'Datasource unreachable' }] }), 'A')).toEqual({
      kind: 'error',
      message: 'Datasource unreachable',
    });
    expect(classifyQueryPreview(makeData([], { error: { refId: 'A', message: 'Permission denied' } }), 'A')).toEqual({
      kind: 'error',
      message: 'Permission denied',
    });
  });

  it('prefers a supplied scoped error message over an earlier missing message', () => {
    expect(
      classifyQueryPreview(
        makeData([], {
          errors: [{ refId: 'A' }, { refId: 'C', message: 'Expression input missing' }],
        }),
        'A'
      )
    ).toEqual({ kind: 'error', message: 'Expression input missing' });
  });

  it('truncates long datasource errors for display', () => {
    expect(classifyQueryPreview(makeData([], { errors: [{ refId: 'A', message: 'x'.repeat(800) }] }), 'A')).toEqual({
      kind: 'error',
      message: 'x'.repeat(499) + '…',
    });
  });

  it.each([
    { name: 'no frames', series: [] },
    { name: 'no rows', series: [numericFrame('A', [])] },
    { name: 'all-null values with timestamps', series: [numericFrame('A', [null, null])] },
  ])('classifies $name as no-data', ({ series }) => {
    expect(classifyQueryPreview(makeData(series), 'A')).toEqual({ kind: 'no-data' });
  });

  it('keeps text-only frames out of no-signal', () => {
    const frame = toDataFrame({ refId: 'A', fields: [{ name: 'message', type: FieldType.string, values: ['ready'] }] });
    expect(classifyQueryPreview(makeData([frame]), 'A')).toEqual({ kind: 'ok', notices: [] });
  });

  it('classifies all non-null numeric values being zero separately from no-data', () => {
    expect(classifyQueryPreview(makeData([numericFrame('A', [0, null, 0])]), 'A')).toEqual({ kind: 'no-signal' });
  });

  it('classifies mixed numeric values as ok', () => {
    expect(classifyQueryPreview(makeData([numericFrame('A', [0, null, 4])]), 'A')).toEqual({ kind: 'ok', notices: [] });
  });

  it('includes dependent expression values when deciding whether there is signal', () => {
    expect(classifyQueryPreview(makeData([numericFrame('A', [0]), numericFrame('D', [2])]), 'A')).toEqual({
      kind: 'ok',
      notices: [],
    });
  });

  it('shows scoped warning notices only when no other callout applies', () => {
    const selected = numericFrame('A', [2]);
    selected.meta = { notices: [{ severity: 'warning', text: 'Results were truncated' }] };
    const unrelated = numericFrame('B', [2]);
    unrelated.meta = { notices: [{ severity: 'warning', text: 'Other query was truncated' }] };
    expect(classifyQueryPreview(makeData([selected, unrelated]), 'A')).toEqual({
      kind: 'ok',
      notices: ['Results were truncated'],
    });
    selected.fields[1].values = [0];
    expect(classifyQueryPreview(makeData([selected, unrelated]), 'A')).toEqual({ kind: 'no-signal' });
  });
});

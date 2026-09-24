import { createDataFrame, FieldType } from '@grafana/data';

import { parseMetricsFilter, summarizeMetricsFilter, validateMetricsScope } from './metricsFilter';
import { runInstantQueries } from './promQuery';

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
}));

const mockRunInstantQueries = jest.mocked(runInstantQueries);

const prom = { uid: 'prom-uid', type: 'prometheus' };
const stored = {
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  excludes: [{ label: 'instance', regex: 'cache-.*' }],
  ratioExpr: '',
};
const ratioFrame = (value: number, labels?: Record<string, string>) =>
  createDataFrame({ refId: 'ratio', fields: [{ name: 'Value', type: FieldType.number, values: [value], labels }] });

beforeEach(() => {
  mockRunInstantQueries.mockReset();
});

describe('parseMetricsFilter', () => {
  it('drops half-filled rows, trims, and reads nothing left as unscoped', () => {
    const rows = [
      { label: ' instance ', regex: ' cache-.* ' },
      { label: 'job', regex: '' },
      { label: '', regex: 'x' },
    ];

    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows, ratioExpr: ' ' }))).toEqual(stored);
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows.slice(1) }))).toBeNull();
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: [], ratioExpr: ' my_ratio ' }))).toEqual({
      ...stored,
      excludes: [],
      ratioExpr: 'my_ratio',
    });
  });

  it('refuses a filter whose label name would break the query', () => {
    expect(
      parseMetricsFilter(JSON.stringify({ ...stored, excludes: [{ label: 'inst-ance', regex: 'x' }] }))
    ).toBeNull();
  });
});

describe('summarizeMetricsFilter', () => {
  it('lists the exclusions, or names the custom expression', () => {
    expect(
      summarizeMetricsFilter({ ...stored, excludes: [...stored.excludes, { label: 'mountpoint', regex: '/scratch' }] })
    ).toBe('Excluding instance: cache-.*, mountpoint: /scratch');
    expect(summarizeMetricsFilter({ ...stored, ratioExpr: 'my_ratio' })).toBe('Custom expression');
  });
});

describe('validateMetricsScope', () => {
  it('rejects a malformed label name without querying', async () => {
    await expect(
      validateMetricsScope({ excludes: [{ label: 'inst-ance', regex: 'x' }], ratioExpr: '' }, prom)
    ).resolves.toBe('Label names may only contain letters, digits and underscores.');
    expect(mockRunInstantQueries).not.toHaveBeenCalled();
  });

  it('accepts exclusions alone without querying', async () => {
    await expect(validateMetricsScope({ excludes: stored.excludes, ratioExpr: ' ' }, prom)).resolves.toBeNull();
    expect(mockRunInstantQueries).not.toHaveBeenCalled();
  });

  it('runs a custom expression once and reports what the datasource rejected', async () => {
    mockRunInstantQueries.mockRejectedValue(new Error('parse error: unexpected end of input'));

    await expect(validateMetricsScope({ excludes: [], ratioExpr: ' bad( ' }, prom)).resolves.toBe(
      'The expression failed: parse error: unexpected end of input'
    );
    expect(mockRunInstantQueries).toHaveBeenCalledTimes(1);
    expect(mockRunInstantQueries).toHaveBeenCalledWith({ ratio: 'bad(' }, prom);
  });

  it.each([
    ['no series', [], 'The expression returned no series. It must return one value per filesystem.'],
    [
      'a series without an instance label',
      [ratioFrame(0.5, { mountpoint: '/' })],
      'Every series the expression returns must carry an instance label.',
    ],
    [
      'a value outside 0..1',
      [ratioFrame(0.5, { instance: 'a' }), ratioFrame(42, { instance: 'b' })],
      'The expression must return values between 0 (empty) and 1 (full).',
    ],
  ])('rejects an expression returning %s', async (_case, frames, message) => {
    mockRunInstantQueries.mockResolvedValue(frames);

    await expect(validateMetricsScope({ excludes: [], ratioExpr: 'my_ratio' }, prom)).resolves.toBe(message);
  });

  it('accepts per-instance ratios, ignoring NaN gaps', async () => {
    mockRunInstantQueries.mockResolvedValue([
      ratioFrame(0.96, { instance: 'a', mountpoint: '/' }),
      ratioFrame(NaN, { instance: 'b' }),
    ]);

    await expect(validateMetricsScope({ excludes: [], ratioExpr: 'my_ratio' }, prom)).resolves.toBeNull();
  });
});

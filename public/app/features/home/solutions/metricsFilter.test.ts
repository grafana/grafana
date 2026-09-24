import { parseMetricsFilter, summarizeMetricsFilter, validateMetricsScope } from './metricsFilter';

const stored = {
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  excludes: [{ label: 'instance', regex: 'cache-.*' }],
};

describe('parseMetricsFilter', () => {
  it('drops half-filled rows, trims, and reads nothing left as unscoped', () => {
    const rows = [
      { label: ' instance ', regex: ' cache-.* ' },
      { label: 'job', regex: '' },
      { label: '', regex: 'x' },
    ];

    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows }))).toEqual(stored);
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows.slice(1) }))).toBeNull();
  });

  it('refuses a filter whose label name would break the query', () => {
    expect(
      parseMetricsFilter(JSON.stringify({ ...stored, excludes: [{ label: 'inst-ance', regex: 'x' }] }))
    ).toBeNull();
  });
});

describe('summarizeMetricsFilter', () => {
  it('lists the exclusions', () => {
    expect(
      summarizeMetricsFilter({ ...stored, excludes: [...stored.excludes, { label: 'mountpoint', regex: '/scratch' }] })
    ).toBe('Excluding instance: cache-.*, mountpoint: /scratch');
  });
});

describe('validateMetricsScope', () => {
  it('rejects a malformed label name and lets a half-filled row through', () => {
    expect(validateMetricsScope({ excludes: [{ label: 'inst-ance', regex: 'x' }] })).toBe(
      'Label names may only contain letters, digits and underscores.'
    );
    expect(validateMetricsScope({ excludes: [...stored.excludes, { label: '', regex: 'x' }] })).toBeNull();
  });
});

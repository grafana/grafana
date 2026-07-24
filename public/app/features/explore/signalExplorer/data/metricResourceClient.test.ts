import type { TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { fetchCatalog, fetchLabelKeys, fetchLabelValues, __clearCache } from './metricResourceClient';

const range = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const makeLP = () => ({
  start: jest.fn().mockResolvedValue([]),
  retrieveMetrics: jest.fn().mockReturnValue(['http_requests_total', 'node_load1']),
  retrieveMetricsMetadata: jest.fn().mockReturnValue({
    http_requests_total: { type: 'counter', help: 'total reqs', unit: '' },
    node_load1: { type: 'gauge', help: 'load' },
  }),
  queryLabelKeys: jest.fn().mockResolvedValue(['instance', 'job']),
  queryLabelValues: jest.fn().mockResolvedValue(['web-1', 'web-2']),
});

jest.mock('@grafana/runtime/unstable', () => ({ getDataSourceInstance: jest.fn() }));

describe('metricResourceClient', () => {
  beforeEach(() => {
    __clearCache();
    (getDataSourceInstance as jest.Mock).mockReset();
  });

  it('maps names+metadata into MetricRow with derived type', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    const rows = await fetchCatalog({ uid: 'p1' }, range);
    expect(lp.start).toHaveBeenCalled();
    expect(rows).toEqual([
      { name: 'http_requests_total', type: 'counter', help: 'total reqs', unit: '' },
      { name: 'node_load1', type: 'gauge', help: 'load', unit: undefined },
    ]);
  });

  it('is single-flight: two concurrent calls resolve one start()', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    const [a, b] = await Promise.all([fetchCatalog({ uid: 'p1' }, range), fetchCatalog({ uid: 'p1' }, range)]);
    expect(a).toBe(b); // same memoized promise result
    expect(lp.start).toHaveBeenCalledTimes(1);
  });

  it('lookupsDisabled / empty metrics → [] without throwing', async () => {
    (getDataSourceInstance as jest.Mock).mockResolvedValue({
      languageProvider: { start: jest.fn().mockResolvedValue([]), retrieveMetrics: () => [], retrieveMetricsMetadata: () => ({}) },
    });
    await expect(fetchCatalog({ uid: 'p2' }, range)).resolves.toEqual([]);
  });

  it('scopes label keys by the metric selector', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    const keys = await fetchLabelKeys({ uid: 'p1' }, range, 'http_requests_total');
    expect(keys).toEqual(['instance', 'job']);
    expect(lp.queryLabelKeys).toHaveBeenCalledWith(range, '{__name__="http_requests_total"}');
  });

  it('scopes label values by the metric selector and label key', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    const values = await fetchLabelValues({ uid: 'p1' }, range, 'http_requests_total', 'job');
    expect(values).toEqual(['web-1', 'web-2']);
    expect(lp.queryLabelValues).toHaveBeenCalledWith(range, 'job', '{__name__="http_requests_total"}');
  });

  it('does not cache a rejected fetch: a retry can succeed', async () => {
    (getDataSourceInstance as jest.Mock).mockRejectedValueOnce(new Error('resolve failed'));
    await expect(fetchCatalog({ uid: 'p3' }, range)).rejects.toThrow('resolve failed');

    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValueOnce({ languageProvider: lp });
    await expect(fetchCatalog({ uid: 'p3' }, range)).resolves.toEqual([
      { name: 'http_requests_total', type: 'counter', help: 'total reqs', unit: '' },
      { name: 'node_load1', type: 'gauge', help: 'load', unit: undefined },
    ]);
  });

  it('does not share a cache entry between two different dsRef uids (mixed-mode safety)', async () => {
    const lpA = makeLP();
    lpA.retrieveMetrics.mockReturnValue(['a_metric']);
    lpA.retrieveMetricsMetadata.mockReturnValue({ a_metric: { type: 'counter', help: 'from A' } });
    const lpB = makeLP();
    lpB.retrieveMetrics.mockReturnValue(['b_metric']);
    lpB.retrieveMetricsMetadata.mockReturnValue({ b_metric: { type: 'gauge', help: 'from B' } });

    (getDataSourceInstance as jest.Mock).mockImplementation((ref: { uid?: string }) =>
      Promise.resolve({ languageProvider: ref.uid === 'ds-a' ? lpA : lpB })
    );

    const [rowsA, rowsB] = await Promise.all([
      fetchCatalog({ uid: 'ds-a' }, range),
      fetchCatalog({ uid: 'ds-b' }, range),
    ]);

    expect(rowsA).toEqual([{ name: 'a_metric', type: 'counter', help: 'from A', unit: undefined }]);
    expect(rowsB).toEqual([{ name: 'b_metric', type: 'gauge', help: 'from B', unit: undefined }]);
    expect(lpA.start).toHaveBeenCalledTimes(1);
    expect(lpB.start).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly when the resolved datasource has no languageProvider', async () => {
    (getDataSourceInstance as jest.Mock).mockResolvedValue({});
    await expect(fetchCatalog({ uid: 'p4' }, range)).rejects.toThrow(/language provider/i);
  });
});

import type { TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import {
  CACHE_TTL_MS,
  dsKey,
  fetchCatalog,
  fetchLabelKeys,
  fetchLabelValues,
  getMetricCacheGeneration,
  invalidateMetricCache,
  subscribeToMetricCache,
  __clearCache,
} from './metricResourceClient';

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

  // Prometheus keys `/api/v1/metadata` by the BASE metric name, but the catalog lists the series. A
  // classic histogram or summary is only ever `<base>_bucket`/`_sum`/`_count` in the catalog, so
  // looking metadata up by the series name misses every one of them. Measured against
  // gdev-prometheus, that typed 624 of 1031 metrics `unknown` and meant the histogram branch of
  // `deriveMetricType` never fired at all.
  describe('metadata for classic histogram and summary series', () => {
    const withMetadata = (names: string[], meta: Record<string, { type?: string; help?: string; unit?: string }>) => {
      const lp = makeLP();
      lp.retrieveMetrics.mockReturnValue(names);
      lp.retrieveMetricsMetadata.mockReturnValue(meta);
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    };

    it('types a histogram series from the base metric’s metadata', async () => {
      withMetadata(
        ['go_gc_pauses_seconds_bucket', 'go_gc_pauses_seconds_sum', 'go_gc_pauses_seconds_count'],
        { go_gc_pauses_seconds: { type: 'histogram', help: 'GC pause distribution' } }
      );

      const rows = await fetchCatalog({ uid: 'h1' }, range);

      expect(rows.map((row) => row.type)).toEqual(['histogram', 'histogram', 'histogram']);
      // The help text describes the family, so it is the best answer for a member of it.
      expect(rows[0].help).toBe('GC pause distribution');
    });

    it('types a summary series from the base metric’s metadata', async () => {
      withMetadata(['request_duration_seconds_sum'], {
        request_duration_seconds: { type: 'summary', help: 'request duration' },
      });

      await expect(fetchCatalog({ uid: 'h2' }, range)).resolves.toEqual([
        { name: 'request_duration_seconds_sum', type: 'summary', help: 'request duration', unit: undefined },
      ]);
    });

    it('prefers a series’ own metadata over the base name’s', async () => {
      withMetadata(['http_requests_count'], {
        http_requests_count: { type: 'counter', help: 'own' },
        http_requests: { type: 'histogram', help: 'base' },
      });

      const [row] = await fetchCatalog({ uid: 'h3' }, range);

      expect(row.type).toBe('counter');
      expect(row.help).toBe('own');
    });

    // An OpenMetrics counter is exposed as `foo_total` while its metadata is keyed `foo`. 194 of
    // gdev-prometheus's names are like this, every one of them a counter.
    it('types an OpenMetrics counter series from its family metadata', async () => {
      withMetadata(['deprecated_flags_inuse_total'], {
        deprecated_flags_inuse: { type: 'counter', help: 'in-use deprecated flags' },
      });

      const [row] = await fetchCatalog({ uid: 'h5' }, range);

      expect(row.type).toBe('counter');
    });

    // `_total` must not reach the classic/native histogram split: a counter's `_total` is not a bucket.
    it('does not treat a `_total` series as a classic histogram member', async () => {
      withMetadata(['odd_total'], { odd: { type: 'histogram', help: 'h' } });

      const [row] = await fetchCatalog({ uid: 'h6' }, range);

      expect(row.type).toBe('native histogram');
    });

    it('leaves a metric with no suffix and no metadata as unknown', async () => {
      withMetadata(['mystery_metric'], {});

      await expect(fetchCatalog({ uid: 'h4' }, range)).resolves.toEqual([
        { name: 'mystery_metric', type: 'unknown', help: undefined, unit: undefined },
      ]);
    });
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

  // Verified against gdev-prometheus: the labels endpoint really does return `__name__`, and
  // `@grafana/prometheus`'s `queryLabelKeys` passes it straight through (`res.slice().sort()`).
  it('drops `__name__` from a metric’s label keys, which the selector already pins to that metric', async () => {
    const lp = makeLP();
    lp.queryLabelKeys.mockResolvedValue(['__name__', 'instance', 'job']);
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });

    await expect(fetchLabelKeys({ uid: 'p1' }, range, 'up')).resolves.toEqual(['instance', 'job']);
  });

  it('scopes label values by the metric selector and label key', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
    const values = await fetchLabelValues({ uid: 'p1' }, range, 'http_requests_total', 'job');
    expect(values).toEqual(['web-1', 'web-2']);
    expect(lp.queryLabelValues).toHaveBeenCalledWith(range, 'job', '{__name__="http_requests_total"}');
  });

  it('escapes a UTF-8 metric name so the selector stays well-formed', async () => {
    const lp = makeLP();
    (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });

    await fetchLabelKeys({ uid: 'p1' }, range, 'weird"name\\with_escapes');

    expect(lp.queryLabelKeys).toHaveBeenCalledWith(range, '{__name__="weird\\"name\\\\with_escapes"}');
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

  describe('expiry', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('serves a later call from cache while the entry is still fresh', async () => {
      jest.useFakeTimers();
      const lp = makeLP();
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });

      await fetchCatalog({ uid: 'p1' }, range);
      jest.advanceTimersByTime(CACHE_TTL_MS - 1);
      await fetchCatalog({ uid: 'p1' }, range);

      expect(lp.start).toHaveBeenCalledTimes(1);
    });

    it('refetches once the entry has expired, so a newly scraped metric can appear', async () => {
      jest.useFakeTimers();
      const lp = makeLP();
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });

      await fetchCatalog({ uid: 'p1' }, range);
      lp.retrieveMetrics.mockReturnValue(['http_requests_total', 'node_load1', 'brand_new_total']);
      jest.advanceTimersByTime(CACHE_TTL_MS + 1);
      const rows = await fetchCatalog({ uid: 'p1' }, range);

      expect(lp.start).toHaveBeenCalledTimes(2);
      expect(rows.map((row) => row.name)).toContain('brand_new_total');
    });

    it('expires label values too, not only the catalog', async () => {
      jest.useFakeTimers();
      const lp = makeLP();
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });

      await fetchLabelValues({ uid: 'p1' }, range, 'http_requests_total', 'job');
      jest.advanceTimersByTime(CACHE_TTL_MS + 1);
      await fetchLabelValues({ uid: 'p1' }, range, 'http_requests_total', 'job');

      expect(lp.queryLabelValues).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidation', () => {
    const twoDatasources = () => {
      const lpA = makeLP();
      const lpB = makeLP();
      (getDataSourceInstance as jest.Mock).mockImplementation((ref: { uid?: string }) =>
        Promise.resolve({ languageProvider: ref.uid === 'ds-a' ? lpA : lpB })
      );
      return { lpA, lpB };
    };

    it('drops every cached entry so the next call refetches', async () => {
      const lp = makeLP();
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ languageProvider: lp });
      await fetchCatalog({ uid: 'p1' }, range);
      await fetchLabelKeys({ uid: 'p1' }, range, 'http_requests_total');

      invalidateMetricCache();

      await fetchCatalog({ uid: 'p1' }, range);
      await fetchLabelKeys({ uid: 'p1' }, range, 'http_requests_total');
      expect(lp.start).toHaveBeenCalledTimes(2);
      expect(lp.queryLabelKeys).toHaveBeenCalledTimes(2);
    });

    it('drops only the given datasource when one is named', async () => {
      const { lpA, lpB } = twoDatasources();
      await fetchCatalog({ uid: 'ds-a' }, range);
      await fetchCatalog({ uid: 'ds-b' }, range);

      invalidateMetricCache({ uid: 'ds-a' });

      await fetchCatalog({ uid: 'ds-a' }, range);
      await fetchCatalog({ uid: 'ds-b' }, range);
      expect(lpA.start).toHaveBeenCalledTimes(2);
      expect(lpB.start).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers with a changed generation for the invalidated datasource only', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToMetricCache(listener);
      const before = getMetricCacheGeneration(dsKey({ uid: 'ds-a' }));
      const otherBefore = getMetricCacheGeneration(dsKey({ uid: 'ds-b' }));

      invalidateMetricCache({ uid: 'ds-a' });

      expect(listener).toHaveBeenCalled();
      expect(getMetricCacheGeneration(dsKey({ uid: 'ds-a' }))).not.toBe(before);
      expect(getMetricCacheGeneration(dsKey({ uid: 'ds-b' }))).toBe(otherBefore);
      unsubscribe();
    });

    it('changes the generation of every datasource when none is named', () => {
      const before = getMetricCacheGeneration(dsKey({ uid: 'ds-b' }));

      invalidateMetricCache();

      expect(getMetricCacheGeneration(dsKey({ uid: 'ds-b' }))).not.toBe(before);
    });

    it('stops notifying an unsubscribed listener', () => {
      const listener = jest.fn();
      subscribeToMetricCache(listener)();

      invalidateMetricCache();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('fails cleanly when the resolved datasource has no languageProvider', async () => {
    (getDataSourceInstance as jest.Mock).mockResolvedValue({});
    await expect(fetchCatalog({ uid: 'p4' }, range)).rejects.toThrow(/language provider/i);
  });
});

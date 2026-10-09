import { dateTime, type TimeRange } from '@grafana/data';
import { type PrometheusDatasource } from '@grafana/prometheus';

import { type ResourcesAPI } from '../../../resources/ResourcesAPI';

import { CloudWatchPromQLLanguageProvider } from './CloudWatchPromQLLanguageProvider';

const clientStart = jest.fn();
const clientQueryLabelKeys = jest.fn().mockResolvedValue(['job']);
const clientQueryLabelValues = jest.fn().mockResolvedValue(['prometheus']);

// The provider wraps @grafana/prometheus' LabelsApiClient; stub it so construction is cheap
// and the delegating methods have a controllable client.
jest.mock('@grafana/prometheus', () => ({
  LabelsApiClient: jest.fn().mockImplementation(() => ({
    start: clientStart,
    labelKeys: ['instance', 'job'],
    metrics: ['up', 'go_goroutines'],
    histogramMetrics: ['latency_bucket'],
    queryLabelKeys: clientQueryLabelKeys,
    queryLabelValues: clientQueryLabelValues,
  })),
}));

const timeRange: TimeRange = {
  from: dateTime(0),
  to: dateTime(1000),
  raw: { from: 'now-6h', to: 'now' },
};

function setup(region = 'us-east-1') {
  const resources = {
    getPromQLLabelKeys: jest.fn().mockResolvedValue(['instance', 'job']),
    getPromQLLabelValues: jest.fn().mockResolvedValue(['host-a', 'host-b']),
  } as unknown as jest.Mocked<Pick<ResourcesAPI, 'getPromQLLabelKeys' | 'getPromQLLabelValues'>>;

  const datasource = {} as PrometheusDatasource;
  const provider = new CloudWatchPromQLLanguageProvider(datasource, resources as unknown as ResourcesAPI, region);
  return { provider, resources };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CloudWatchPromQLLanguageProvider', () => {
  describe('request (Prometheus -> CloudWatch resource adapter)', () => {
    it('maps the labels endpoint to getPromQLLabelKeys with parsed params', async () => {
      const { provider, resources } = setup();

      const result = await provider.request('/api/v1/labels', {
        start: '100',
        end: '200',
        limit: '5',
        'match[]': 'up',
      });

      expect(resources.getPromQLLabelKeys).toHaveBeenCalledWith('us-east-1', 'up', 100, 200, 5);
      expect(result).toEqual(['instance', 'job']);
    });

    it('maps the label-values endpoint and decodes the label key', async () => {
      const { provider, resources } = setup();

      const result = await provider.request('/api/v1/label/foo%2Fbar/values', { start: '100' });

      expect(resources.getPromQLLabelValues).toHaveBeenCalledWith(
        'us-east-1',
        'foo/bar',
        undefined,
        100,
        undefined,
        undefined
      );
      expect(result).toEqual(['host-a', 'host-b']);
    });

    it('returns an empty array for unrecognised endpoints', async () => {
      const { provider, resources } = setup();

      const result = await provider.request('/api/v1/series', {});

      expect(result).toEqual([]);
      expect(resources.getPromQLLabelKeys).not.toHaveBeenCalled();
      expect(resources.getPromQLLabelValues).not.toHaveBeenCalled();
    });

    it('swallows resource errors and returns an empty array', async () => {
      const { provider, resources } = setup();
      (resources.getPromQLLabelKeys as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      await expect(provider.request('/api/v1/labels', {})).resolves.toEqual([]);
    });

    it('uses the updated region after updateRegion', async () => {
      const { provider, resources } = setup('us-east-1');
      provider.updateRegion('eu-west-2');

      await provider.request('/api/v1/labels', {});

      expect(resources.getPromQLLabelKeys).toHaveBeenCalledWith(
        'eu-west-2',
        undefined,
        undefined,
        undefined,
        undefined
      );
    });
  });

  describe('client delegation', () => {
    it('start() forwards to the client and returns an empty array', async () => {
      const { provider } = setup();

      await expect(provider.start(timeRange)).resolves.toEqual([]);
      expect(clientStart).toHaveBeenCalledWith(timeRange);
    });

    it('queryLabelKeys/queryLabelValues delegate to the client', async () => {
      const { provider } = setup();

      await expect(provider.queryLabelKeys(timeRange, 'up', 10)).resolves.toEqual(['job']);
      expect(clientQueryLabelKeys).toHaveBeenCalledWith(timeRange, 'up', 10);

      await expect(provider.queryLabelValues(timeRange, 'instance', 'up', 10)).resolves.toEqual(['prometheus']);
      expect(clientQueryLabelValues).toHaveBeenCalledWith(timeRange, 'instance', 'up', 10);
    });

    it('exposes cached metrics and label keys from the client', () => {
      const { provider } = setup();

      expect(provider.retrieveLabelKeys()).toEqual(['instance', 'job']);
      expect(provider.retrieveMetrics()).toEqual(['up', 'go_goroutines']);
      expect(provider.retrieveHistogramMetrics()).toEqual(['latency_bucket']);
    });
  });

  describe('unsupported CloudWatch endpoints', () => {
    it('returns empty metadata and suggestions (no /metadata or /suggestions endpoint)', async () => {
      const { provider } = setup();

      expect(provider.retrieveMetricsMetadata()).toEqual({});
      await expect(provider.queryMetricsMetadata()).resolves.toEqual({});
      await expect(provider.fetchSuggestions()).resolves.toEqual([]);
    });
  });
});

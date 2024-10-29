import { of } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import * as runtime from '@grafana/runtime';

import {
  fetchAndExtractLokiRecordingRules,
  getLokiQueryForRelatedMetric,
  getDataSourcesWithRecordingRulesContainingMetric,
  type ExtractedRecordingRules,
  type RecordingRuleGroup,
} from './logsIntegration';

const mockLokiDS1: DataSourceInstanceSettings<DataSourceJsonData> = {
  access: 'proxy',
  id: 1,
  uid: 'loki1',
  name: 'Loki Main',
  type: 'loki',
  url: '',
  jsonData: {},
  meta: {
    ...getMockPlugin(),
    id: 'loki',
  },
  readOnly: false,
  isDefault: false,
  database: '',
  withCredentials: false,
};

const mockLokiDS2: DataSourceInstanceSettings<DataSourceJsonData> = {
  ...mockLokiDS1,
  id: 2,
  uid: 'loki2',
  name: 'Loki Secondary',
};

const mockRuleGroups1: RecordingRuleGroup[] = [
  {
    name: 'group1',
    rules: [
      {
        name: 'metric_a_total',
        query: 'sum(rate({app="app-A"} |= "error" [5m]))',
        type: 'recording',
      },
      {
        name: 'metric_b_total',
        query: 'sum(rate({app="app-B"} |= "warn" [5m]))',
        type: 'recording',
      },
    ],
  },
];

const mockRuleGroups2: RecordingRuleGroup[] = [
  {
    name: 'group2',
    rules: [
      {
        name: 'metric_a_total', // Intentionally same name as in DS1
        query: 'sum(rate({app="app-C"} |= "error" [5m]))',
        type: 'recording',
      },
    ],
  },
];

const mockExtractedRules: ExtractedRecordingRules = {
  loki1: [
    {
      name: 'metric_a_total',
      query: 'sum(rate({app="app-A"} |= "error" [5m]))',
      type: 'recording',
      datasource: { name: 'Loki Main', uid: 'loki1' },
    },
    {
      name: 'metric_b_total',
      query: 'sum(rate({app="app-B"} |= "warn" [5m]))',
      type: 'recording',
      datasource: { name: 'Loki Main', uid: 'loki1' },
    },
  ],
  loki2: [
    {
      name: 'metric_a_total',
      query: 'sum(rate({app="app-C"} |= "error" [5m]))',
      type: 'recording',
      datasource: { name: 'Loki Secondary', uid: 'loki2' },
    },
  ],
};

// Create spy functions
const getListSpy = jest.fn().mockReturnValue([mockLokiDS1, mockLokiDS2]);
const fetchSpy = jest.fn().mockImplementation((req) => {
  if (req.url.includes('loki1')) {
    return of({
      data: { data: { groups: mockRuleGroups1 } },
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: req.url,
      config: { url: req.url },
    } as runtime.FetchResponse);
  }
  return of({
    data: { data: { groups: mockRuleGroups2 } },
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: req.url,
    config: { url: req.url },
  } as runtime.FetchResponse);
});

// Mock the entire @grafana/runtime module
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListSpy,
    get: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  }),
  getBackendSrv: () => ({
    fetch: fetchSpy,
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    request: jest.fn(),
    datasourceRequest: jest.fn(),
  }),
}));

describe('Logs Integration', () => {
  describe('fetchAndExtractLokiRecordingRules', () => {
    beforeEach(() => {
      getListSpy.mockClear();
      fetchSpy.mockClear();
    });

    it('should fetch and extract rules from all Loki data sources', async () => {
      const result = await fetchAndExtractLokiRecordingRules();

      expect(result).toEqual(mockExtractedRules);
      expect(getListSpy).toHaveBeenCalledWith({ logs: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle errors from individual data sources gracefully', async () => {
      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      fetchSpy.mockImplementation((req) => {
        if (req.url.includes('loki1')) {
          return of({
            data: { data: { groups: mockRuleGroups1 } },
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            redirected: false,
            type: 'basic',
            url: req.url,
            config: { url: req.url },
          } as runtime.FetchResponse);
        }
        throw new Error('Failed to fetch');
      });

      const result = await fetchAndExtractLokiRecordingRules();

      // Should still have results from the first datasource
      expect(result).toHaveProperty('loki1');
      expect(result.loki1).toHaveLength(2);
      expect(result.loki2).toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getLokiQueryForRelatedMetric', () => {
    it('should return the expected Loki query for a given metric', () => {
      const result = getLokiQueryForRelatedMetric('metric_a_total', 'loki1', mockExtractedRules);
      expect(result).toBe('{app="app-A"} |= "error"');
    });

    it('should return empty string for non-existent data source', () => {
      const result = getLokiQueryForRelatedMetric('metric_a_total', 'non-existent', mockExtractedRules);
      expect(result).toBe('');
    });

    it('should return empty string for non-existent metric', () => {
      const result = getLokiQueryForRelatedMetric('non_existent_metric', 'loki1', mockExtractedRules);
      expect(result).toBe('');
    });
  });

  describe('getDataSourcesWithRecordingRulesContainingMetric', () => {
    it('should find all data sources containing recording rules that define the metric of interest', () => {
      const result = getDataSourcesWithRecordingRulesContainingMetric('metric_a_total', mockExtractedRules);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ name: 'Loki Main', uid: 'loki1' });
      expect(result).toContainEqual({ name: 'Loki Secondary', uid: 'loki2' });
    });

    it('should return empty array for non-existent metric', () => {
      const result = getDataSourcesWithRecordingRulesContainingMetric('non_existent_metric', mockExtractedRules);
      expect(result).toHaveLength(0);
    });

    it('should find single data source for unique metric', () => {
      const result = getDataSourcesWithRecordingRulesContainingMetric('metric_b_total', mockExtractedRules);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'Loki Main', uid: 'loki1' });
    });
  });
});

import { of } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import * as runtime from '@grafana/runtime';

import { MetricsLogsConnector } from './base';
import { lokiRecordingRulesConnector, type RecordingRuleGroup } from './lokiRecordingRules';

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

// Create spy functions
const getListSpy = jest.fn().mockReturnValue([mockLokiDS1, mockLokiDS2]);
const defaultFetchImpl = (req: Request) => {
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
};
const fetchSpy = jest.fn().mockImplementation(defaultFetchImpl);

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

describe('LokiRecordingRulesConnector', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    getListSpy.mockClear();
    fetchSpy.mockClear();
    fetchSpy.mockImplementation(defaultFetchImpl);
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getDataSources', () => {
    it('should find all data sources containing the metric', async () => {
      const connector = lokiRecordingRulesConnector;
      const result = await connector.getDataSources('metric_a_total');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ name: 'Loki Main', uid: 'loki1' });
      expect(result).toContainEqual({ name: 'Loki Secondary', uid: 'loki2' });

      // Verify underlying calls
      expect(getListSpy).toHaveBeenCalledWith({ logs: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle non-existent metrics', async () => {
      const connector = lokiRecordingRulesConnector;
      const result = await connector.getDataSources('non_existent_metric');

      expect(result).toHaveLength(0);
    });

    it('should handle datasource fetch errors gracefully', async () => {
      // Make the second datasource fail
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

      const connector = lokiRecordingRulesConnector;
      const result = await connector.getDataSources('metric_a_total');

      // Should still get results from the working datasource
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'Loki Main', uid: 'loki1' });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('getLokiQueryExpr', () => {
    let connector: MetricsLogsConnector;

    beforeEach(async () => {
      connector = lokiRecordingRulesConnector;
      // Populate the rules first
      await connector.getDataSources('metric_a_total');
    });

    it('should return correct Loki query for existing metric', () => {
      const result = connector.getLokiQueryExpr('metric_a_total', 'loki1');
      expect(result).toBe('{app="app-A"} |= "error"');
    });

    it('should return empty string for non-existent metric', () => {
      const result = connector.getLokiQueryExpr('non_existent_metric', 'loki1');
      expect(result).toBe('');
    });

    it('should handle multiple occurrences of the same metric name', () => {
      const query1 = connector.getLokiQueryExpr('metric_a_total', 'loki1');
      const query2 = connector.getLokiQueryExpr('metric_a_total', 'loki2');

      expect(query1).toBe('{app="app-A"} |= "error"');
      expect(query2).toBe('{app="app-C"} |= "error"');
    });

    it('should handle rules with hasMultipleOccurrences flag', () => {
      const query = connector.getLokiQueryExpr('metric_a_total', 'loki1');
      expect(query).toBe('{app="app-A"} |= "error"');
    });
  });
});

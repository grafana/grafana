import { getTemplateSrv } from '@grafana/runtime';

import { HttpRequestMethod } from '../../panelcfg.gen';

import type { APIEditorConfig } from './APIEditor';
import { getRequest, interpolateVariables } from './utils';

jest.mock('@grafana/runtime');
jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => ({
    getCurrent: () => ({ panelInEdit: { scopedVars: {} } }),
  }),
}));
jest.mock('app/features/alerting/unified/utils/url', () => ({
  createAbsoluteUrl: (url: string) => `https://example.com${url}`,
}));
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  textUtil: {
    sanitizeUrl: (url: string) => url,
  },
}));

const mockTemplateReplacement = (replaceFn: (text: string) => string) => {
  jest.mocked(getTemplateSrv).mockReturnValue({
    replace: replaceFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
};

const createMockApiConfig = (config: Partial<APIEditorConfig>): APIEditorConfig => {
  return config as APIEditorConfig;
};

describe('editor/element/utils', () => {
  beforeEach(() => {
    mockTemplateReplacement((text: string) => text);
  });

  describe('interpolateVariables', () => {
    it('should call template service replace', () => {
      const mockReplace = jest.fn((text) => text);
      mockTemplateReplacement(mockReplace);

      const result = interpolateVariables('test ${var}');

      expect(mockReplace).toHaveBeenCalledWith('test ${var}', {});
      expect(result).toBe('test ${var}');
    });

    it('should handle variables replacement', () => {
      mockTemplateReplacement((text: string) => text.replace('${var}', 'value'));

      const result = interpolateVariables('test ${var}');

      expect(result).toBe('test value');
    });
  });

  describe('getRequest', () => {
    it('should build basic GET request', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toBe('https://api.example.com/data');
      expect(result.method).toBe(HttpRequestMethod.GET);
      expect(result.data).toBeUndefined();
      expect(result.headers).toMatchObject({
        'X-Grafana-Action': '1',
      });
    });

    it('should build POST request with data', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.POST,
        data: '{"key": "value"}',
        contentType: 'application/json',
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.method).toBe(HttpRequestMethod.POST);
      expect(result.data).toBe('{"key": "value"}');
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Grafana-Action': '1',
      });
    });

    it('should handle relative URL endpoints', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: '/api/data',
        method: HttpRequestMethod.GET,
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toBe('https://example.com/api/data');
    });

    it('should add query parameters', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        queryParams: [
          ['param1', 'value1'],
          ['param2', 'value2'],
        ],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toContain('param1=value1');
      expect(result.url).toContain('param2=value2');
    });

    it('should add header parameters', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        headerParams: [
          ['Authorization', 'Bearer token'],
          ['X-Custom-Header', 'custom-value'],
        ],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.headers).toMatchObject({
        Authorization: 'Bearer token',
        'X-Custom-Header': 'custom-value',
        'X-Grafana-Action': '1',
      });
    });

    it('should interpolate variables in endpoint', () => {
      mockTemplateReplacement((text: string) => text.replace('${host}', 'example.com'));

      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://${host}/api/data',
        method: HttpRequestMethod.GET,
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toBe('https://example.com/api/data');
    });

    it('should interpolate variables in query params', () => {
      mockTemplateReplacement((text: string) => text.replace('${filter}', 'active'));

      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        queryParams: [['status', '${filter}']],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toContain('status=active');
    });

    it('should interpolate variables in header params', () => {
      mockTemplateReplacement((text: string) => text.replace('${token}', 'secret123'));

      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        headerParams: [['Authorization', 'Bearer ${token}']],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.headers?.Authorization).toBe('Bearer secret123');
    });

    it('should default data to {} for POST when no data provided', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.POST,
        contentType: 'application/json',
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.data).toBe('{}');
    });

    it('should interpolate variables in POST data', () => {
      mockTemplateReplacement((text: string) => text.replace('${username}', 'john'));

      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.POST,
        data: '{"user": "${username}"}',
        contentType: 'application/json',
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.data).toBe('{"user": "john"}');
    });

    it('should handle empty query params array', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        queryParams: [],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.url).toBe('https://api.example.com/data');
    });

    it('should handle empty header params array', () => {
      const api: Partial<APIEditorConfig> = {
        endpoint: 'https://api.example.com/data',
        method: HttpRequestMethod.GET,
        headerParams: [],
      };

      const result = getRequest(createMockApiConfig(api));

      expect(result.headers).toMatchObject({
        'X-Grafana-Action': '1',
      });
      expect(Object.keys(result.headers || {}).length).toBe(1);
    });
  });
});

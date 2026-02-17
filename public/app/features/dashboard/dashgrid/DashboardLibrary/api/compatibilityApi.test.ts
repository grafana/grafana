import { getAPINamespace } from '@grafana/api-clients';
import { BackendSrv, getBackendSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { checkDashboardCompatibility, CompatibilityCheckResult, DatasourceMapping } from './compatibilityApi';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/api-clients', () => ({
  getAPINamespace: jest.fn(),
}));

const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;
const mockGetAPINamespace = getAPINamespace as jest.MockedFunction<typeof getAPINamespace>;

// Helper to create mock BackendSrv
const createMockBackendSrv = (overrides: Partial<BackendSrv> = {}): BackendSrv =>
  ({
    post: jest.fn(),
    ...overrides,
  }) as unknown as BackendSrv;

// Prometheus-specific query type (extends DataQuery)
interface PrometheusQuery extends DataQuery {
  expr: string;
}

// Test fixtures
const createMockDashboard = (overrides: Partial<DashboardJson> = {}): DashboardJson => {
  // Create a minimal dashboard for testing purposes
  // Panels array is intentionally minimal - only includes fields needed for compatibility check
  const dashboard: DashboardJson = {
    title: 'Test Dashboard',
    uid: 'test-uid',
    schemaVersion: 39,
    version: 1,
    panels: [
      {
        id: 1,
        type: 'graph',
        title: 'CPU Usage',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid-123',
        },
        targets: [
          {
            refId: 'A',
            expr: 'rate(cpu_usage_total[5m])',
          } as PrometheusQuery,
        ],
      },
      {
        id: 2,
        type: 'graph',
        title: 'Memory Usage',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid-123',
        },
        targets: [
          {
            refId: 'A',
            expr: 'memory_usage_bytes',
          } as PrometheusQuery,
        ],
      },
    ] as unknown as DashboardJson['panels'],
    ...overrides,
  };
  return dashboard;
};

const createMockDatasourceMappings = (): DatasourceMapping[] => [
  {
    uid: 'prometheus-uid-123',
    type: 'prometheus',
    name: 'Production Prometheus',
  },
];

describe('compatibilityApi', () => {
  let mockPost: jest.MockedFunction<BackendSrv['post']>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockPost = jest.fn();
    mockGetBackendSrv.mockReturnValue(
      createMockBackendSrv({
        post: mockPost,
      })
    );
    // Mock getAPINamespace to return 'default' (typical dev environment)
    mockGetAPINamespace.mockReturnValue('default');
    // Mock console.error to prevent test failures
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('checkDashboardCompatibility', () => {
    it('should successfully check compatibility with high score (100%)', async () => {
      const mockResponse: CompatibilityCheckResult = {
        compatibilityScore: 100,
        datasourceResults: [
          {
            uid: 'prometheus-uid-123',
            type: 'prometheus',
            name: 'Production Prometheus',
            totalQueries: 2,
            checkedQueries: 2,
            totalMetrics: 2,
            foundMetrics: 2,
            missingMetrics: [],
            compatibilityScore: 100,
            queryBreakdown: [
              {
                panelTitle: 'CPU Usage',
                panelID: 1,
                queryRefId: 'A',
                totalMetrics: 1,
                foundMetrics: 1,
                missingMetrics: [],
                compatibilityScore: 100,
              },
              {
                panelTitle: 'Memory Usage',
                panelID: 2,
                queryRefId: 'A',
                totalMetrics: 1,
                foundMetrics: 1,
                missingMetrics: [],
                compatibilityScore: 100,
              },
            ],
          },
        ],
      };

      mockPost.mockResolvedValue(mockResponse);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      const result = await checkDashboardCompatibility(dashboard, mappings);

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith(
        '/apis/dashvalidator.grafana.app/v1alpha1/namespaces/default/check',
        {
          dashboardJson: dashboard,
          datasourceMappings: mappings,
        },
        {
          showErrorAlert: false,
        }
      );
    });

    it('should successfully check compatibility with partial score (50%)', async () => {
      const mockResponse: CompatibilityCheckResult = {
        compatibilityScore: 50,
        datasourceResults: [
          {
            uid: 'prometheus-uid-123',
            type: 'prometheus',
            name: 'Production Prometheus',
            totalQueries: 2,
            checkedQueries: 2,
            totalMetrics: 2,
            foundMetrics: 1,
            missingMetrics: ['http_request_duration_seconds'],
            compatibilityScore: 50,
            queryBreakdown: [
              {
                panelTitle: 'CPU Usage',
                panelID: 1,
                queryRefId: 'A',
                totalMetrics: 1,
                foundMetrics: 1,
                missingMetrics: [],
                compatibilityScore: 100,
              },
              {
                panelTitle: 'Memory Usage',
                panelID: 2,
                queryRefId: 'A',
                totalMetrics: 1,
                foundMetrics: 0,
                missingMetrics: ['http_request_duration_seconds'],
                compatibilityScore: 0,
              },
            ],
          },
        ],
      };

      mockPost.mockResolvedValue(mockResponse);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      const result = await checkDashboardCompatibility(dashboard, mappings);

      expect(result).toEqual(mockResponse);
      expect(result.compatibilityScore).toBe(50);
      expect(result.datasourceResults[0].missingMetrics).toContain('http_request_duration_seconds');
    });

    it('should handle HTTP 404 error (datasource not found)', async () => {
      const error404 = {
        status: 404,
        data: {
          message: 'Datasource not found',
          code: 'datasource_not_found',
        },
      };

      mockPost.mockRejectedValue(error404);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      // Should re-throw original error from getBackendSrv
      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(error404);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Dashboard compatibility check failed:', error404);
    });

    it('should handle HTTP 401 error (authentication failure)', async () => {
      const error401 = {
        status: 401,
        data: {
          message: 'Authentication failed for datasource',
          code: 'datasource_auth_failed',
        },
      };

      mockPost.mockRejectedValue(error401);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(error401);
    });

    it('should handle HTTP 503 error (datasource unreachable)', async () => {
      const error503 = {
        status: 503,
        data: {
          message: 'Datasource is unreachable',
          code: 'datasource_unreachable',
        },
      };

      mockPost.mockRejectedValue(error503);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(error503);
    });

    it('should handle HTTP 502 error (invalid Prometheus API response)', async () => {
      const error502 = {
        status: 502,
        data: {
          message: 'Invalid response from Prometheus API',
          code: 'api_invalid_response',
        },
      };

      mockPost.mockRejectedValue(error502);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(error502);
    });

    it('should handle network error without structured error data', async () => {
      const networkError = {
        message: 'Network request failed',
      };

      mockPost.mockRejectedValue(networkError);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(networkError);
    });

    it('should use namespace from getAPINamespace()', async () => {
      const mockResponse: CompatibilityCheckResult = {
        compatibilityScore: 100,
        datasourceResults: [],
      };

      mockPost.mockResolvedValue(mockResponse);

      // Change namespace returned by getAPINamespace
      mockGetAPINamespace.mockReturnValue('custom-namespace');

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await checkDashboardCompatibility(dashboard, mappings);

      expect(mockPost).toHaveBeenCalledWith(
        '/apis/dashvalidator.grafana.app/v1alpha1/namespaces/custom-namespace/check',
        expect.any(Object),
        expect.any(Object)
      );

      // Reset namespace for other tests
      mockGetAPINamespace.mockReturnValue('default');
    });

    it('should handle generic error without proper structure', async () => {
      const genericError = 'Something went wrong';

      mockPost.mockRejectedValue(genericError);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await expect(checkDashboardCompatibility(dashboard, mappings)).rejects.toEqual(genericError);
    });

    it('should disable automatic error alerts', async () => {
      const mockResponse: CompatibilityCheckResult = {
        compatibilityScore: 100,
        datasourceResults: [],
      };

      mockPost.mockResolvedValue(mockResponse);

      const dashboard = createMockDashboard();
      const mappings = createMockDatasourceMappings();

      await checkDashboardCompatibility(dashboard, mappings);

      // Verify that showErrorAlert is explicitly set to false
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          showErrorAlert: false,
        })
      );
    });
  });
});

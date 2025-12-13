import { renderHook, waitFor } from '@testing-library/react';
import { testWithFeatureToggles } from 'test/test-utils';

import { useSQLSchemas, SQLSchemasResponse } from './useSQLSchemas';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/api-clients', () => ({
  getAPINamespace: jest.fn(() => 'default'),
}));

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getDefaultTimeRange: jest.fn(() => ({
    from: { toISOString: () => '2024-01-01T00:00:00.000Z' },
    to: { toISOString: () => '2024-01-01T23:59:59.999Z' },
  })),
}));

describe('useSQLSchemas', () => {
  testWithFeatureToggles({ enable: ['queryService'] });

  beforeEach(() => jest.clearAllMocks());

  const mockQueries = [
    {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prom-uid' },
    },
  ];

  const mockSchemasResponse: SQLSchemasResponse = {
    kind: 'SQLSchemaResponse',
    apiVersion: 'query.grafana.app/v0alpha1',
    sqlSchemas: {
      A: {
        columns: [
          { name: 'time', mysqlType: 'TIMESTAMP', dataFrameFieldType: 'time', nullable: false },
          { name: 'value', mysqlType: 'FLOAT', dataFrameFieldType: 'number', nullable: true },
        ],
        sampleRows: [[1234567890, 42.5]],
        error: undefined,
      },
    },
  };

  const setupMockBackendSrv = (mockImplementation: jest.Mock) => {
    const { getBackendSrv } = require('@grafana/runtime');
    getBackendSrv.mockReturnValue({ post: mockImplementation });
    return mockImplementation;
  };

  it('fetches schemas successfully and updates state', async () => {
    // Arrange
    const mockPost = setupMockBackendSrv(jest.fn().mockResolvedValue(mockSchemasResponse));

    // Act - Render the hook
    const { result } = renderHook(() => useSQLSchemas({ queries: mockQueries }));

    // Assert - Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.schemas).toBe(null);
    expect(result.current.error).toBe(null);

    // Wait for async fetch to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert - Final state
    expect(result.current.schemas).toEqual(mockSchemasResponse);
    expect(result.current.schemas?.sqlSchemas.A.columns).toHaveLength(2);
    expect(result.current.schemas?.sqlSchemas.A.columns?.[0].name).toBe('time');
    expect(result.current.error).toBe(null);

    // Verify API was called correctly
    expect(mockPost).toHaveBeenCalledWith(
      '/apis/query.grafana.app/v0alpha1/namespaces/default/sqlschemas/name',
      expect.objectContaining({
        queries: mockQueries,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-01T23:59:59.999Z',
      })
    );
  });

  it('handles API errors gracefully without crashing', async () => {
    // Arrange
    const mockError = new Error('Network error');
    setupMockBackendSrv(jest.fn().mockRejectedValue(mockError));

    // Act
    const { result } = renderHook(() => useSQLSchemas({ queries: mockQueries }));

    // Wait for error to be set
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert - Error state is set, no crash
    expect(result.current.error).toEqual(mockError);
    expect(result.current.schemas).toBe(null);
    expect(result.current.loading).toBe(false);
  });

  describe('when feature flag is disabled', () => {
    testWithFeatureToggles({ disable: ['queryService', 'grafanaAPIServerWithExperimentalAPIs'] });

    it('does not fetch schemas', async () => {
      // Arrange
      setupMockBackendSrv(jest.fn());

      // Act
      const { result } = renderHook(() => useSQLSchemas({ queries: mockQueries }));

      // Assert - No API call, feature disabled
      expect(result.current.isFeatureEnabled).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.schemas).toBe(null);
    });
  });

  it('returns empty schemas for empty queries array without calling API', async () => {
    // Arrange
    const mockPost = setupMockBackendSrv(jest.fn());

    // Act - Empty queries array
    const { result } = renderHook(() => useSQLSchemas({ queries: [] }));

    // Wait for state to settle
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert - Returns empty schemas, no API call
    expect(result.current.schemas).toEqual({
      kind: 'SQLSchemaResponse',
      apiVersion: 'query.grafana.app/v0alpha1',
      sqlSchemas: {},
    });
    expect(result.current.error).toBe(null);
    expect(mockPost).not.toHaveBeenCalled(); // No API call for empty queries
  });
});

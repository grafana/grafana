import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import server from './__mocks__/server';
import { useContactPointsWithStatus } from './useContactPoints';

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('useContactPoints', () => {
  it('should return contact points with status', async () => {
    const { result } = renderHook(() => useContactPointsWithStatus('grafana'), {
      wrapper: TestProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});

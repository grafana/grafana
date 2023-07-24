import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import { useContactPointsWithStatus } from './useContactPoints';

describe('useContactPoints', () => {
  setupGrafanaManagedServer();

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

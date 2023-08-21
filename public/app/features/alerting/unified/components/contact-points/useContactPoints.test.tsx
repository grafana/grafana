import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import './__mocks__/server';
import { useContactPointsWithStatus } from './useContactPoints';

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

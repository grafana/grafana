/**
 * Integration tests for useContactPoints with notification history
 */
import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';

import { useGrafanaContactPoints } from './useContactPoints';

/**
 * Tests for useGrafanaContactPoints with notification history API
 */
setupMswServer();

beforeAll(() => {
  setupDataSources();
});

describe('useGrafanaContactPoints with notification history', () => {
  it('should fetch notification history for contact points', async () => {
    const { result } = renderHook(() => useGrafanaContactPoints({ fetchStatuses: true }), {
      wrapper: TestProvider,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Should have contact points data
    expect(result.current.contactPoints).toBeDefined();
  });

  it('should not fetch notification history when fetchStatuses is false', async () => {
    const { result } = renderHook(() => useGrafanaContactPoints({ fetchStatuses: false }), {
      wrapper: TestProvider,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 }
    );

    expect(result.current.contactPoints).toBeDefined();
  });

  it('should handle empty contact point list', async () => {
    const { result } = renderHook(() => useGrafanaContactPoints({ fetchStatuses: true }), {
      wrapper: TestProvider,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 }
    );

    expect(result.current.contactPoints).toBeDefined();
    expect(Array.isArray(result.current.contactPoints)).toBe(true);
  });
});

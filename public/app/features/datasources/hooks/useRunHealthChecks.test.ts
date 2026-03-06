import { act, renderHook, waitFor } from '@testing-library/react';

import type { Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';

import { useRunHealthChecks } from './useRunHealthChecks';

const mockUseCreateCheckMutation = jest.fn();
const mockUseListCheckQuery = jest.fn();

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: { grafanaAdvisor: true },
  },
}));

jest.mock('@grafana/api-clients/rtkq/advisor/v0alpha1', () => ({
  useCreateCheckMutation: (...args: unknown[]) => mockUseCreateCheckMutation(...args),
  useListCheckQuery: (...args: unknown[]) => mockUseListCheckQuery(...args),
}));

const createCheck = jest.fn();

describe('useRunHealthChecks', () => {
  beforeEach(() => {
    createCheck.mockReset();
    mockUseCreateCheckMutation.mockReturnValue([createCheck]);
    mockUseListCheckQuery.mockReturnValue({ data: { items: [] } });
  });

  it('starts in running state when the latest datasource check is still in progress', async () => {
    mockUseListCheckQuery.mockReturnValue({
      data: {
        items: [
          {
            metadata: {
              labels: { 'advisor.grafana.app/type': 'datasource' },
              creationTimestamp: '2024-06-01T00:00:00Z',
              annotations: {},
            },
          },
        ],
      },
    });

    const { result } = renderHook(() => useRunHealthChecks());

    await waitFor(() => expect(result.current.isRunning).toBe(true));
  });

  it('stops running once the latest datasource check is processed', async () => {
    let queryResult: { data: { items: Check[] } } = {
      data: {
        items: [],
      },
    };

    createCheck.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
    });
    mockUseListCheckQuery.mockImplementation(() => queryResult);

    const { result, rerender } = renderHook(() => useRunHealthChecks());

    await act(async () => {
      await result.current.runHealthChecks();
    });

    await waitFor(() => expect(result.current.isRunning).toBe(true));

    queryResult = {
      data: {
        items: [
          {
            apiVersion: 'advisor.grafana.app/v0alpha1',
            kind: 'Check',
            metadata: {
              labels: { 'advisor.grafana.app/type': 'datasource' },
              creationTimestamp: '9999-01-01T00:00:00Z',
              annotations: { 'advisor.grafana.app/status': 'processed' },
            },
            spec: {},
          },
        ],
      },
    };

    rerender();

    await waitFor(() => expect(result.current.isRunning).toBe(false));
  });

  it('resets running state when creating a check fails', async () => {
    createCheck.mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const { result } = renderHook(() => useRunHealthChecks());

    await act(async () => {
      await result.current.runHealthChecks();
    });

    await waitFor(() => expect(result.current.isRunning).toBe(false));
  });
});

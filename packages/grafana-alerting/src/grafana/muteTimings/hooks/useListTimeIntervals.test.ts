import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListTimeIntervalApiResponseFactory,
  TimeIntervalFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listTimeIntervalHandler } from '../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';

import { useListTimeIntervals } from './useListTimeIntervals';

const server = setupMockServer();

describe('useListTimeIntervals', () => {
  it('returns the time intervals from the v1beta1 API', async () => {
    const list = ListTimeIntervalApiResponseFactory.build({
      items: [TimeIntervalFactory.build({ metadata: { name: 'business-hours' } })],
    });
    server.use(listTimeIntervalHandler(list));

    const { result } = renderHook(() => useListTimeIntervals(), { wrapper: getDefaultWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentData?.items).toHaveLength(1);
    expect(result.current.currentData?.items[0].metadata.name).toBe('business-hours');
  });
});

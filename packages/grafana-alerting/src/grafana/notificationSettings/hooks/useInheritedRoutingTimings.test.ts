import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { routingTreeWithErrorScenario } from '../../notificationPolicies/components/RoutingTreeSelector/RoutingTreeSelector.scenario';
import { USER_DEFINED_TREE_NAME } from '../../notificationPolicies/routingTree.utils';
import { TIMING_DEFAULTS } from '../constants';

import { useInheritedRoutingTimings } from './useInheritedRoutingTimings';

const server = setupMockServer();

describe('useInheritedRoutingTimings', () => {
  it('reports resolving with the built-in defaults while the default policy loads, then found with its timings, keeping defaults for unset ones', async () => {
    server.use(
      listRoutingTreeHandler(
        ListRoutingTreeApiResponseFactory.build({
          items: [
            RoutingTreeFactory.build({
              metadata: { name: USER_DEFINED_TREE_NAME },
              spec: { defaults: { group_wait: '45s' } },
            }),
          ],
        })
      )
    );
    const { result } = renderHook(() => useInheritedRoutingTimings(), { wrapper: getDefaultWrapper() });

    expect(result.current).toEqual({ status: 'resolving', timings: TIMING_DEFAULTS });
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.timings).toEqual({ ...TIMING_DEFAULTS, groupWait: '45s' });
  });

  it('reports an error, rather than found, when the list fails to load', async () => {
    server.use(...routingTreeWithErrorScenario);
    const { result } = renderHook(() => useInheritedRoutingTimings(), { wrapper: getDefaultWrapper() });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.timings).toEqual(TIMING_DEFAULTS);
  });

  it('keeps the same timings object across rerenders', async () => {
    server.use(...routingTreeWithErrorScenario);
    const { result, rerender } = renderHook(() => useInheritedRoutingTimings(), { wrapper: getDefaultWrapper() });
    await waitFor(() => expect(result.current.status).toBe('error'));

    const before = result.current.timings;
    rerender();
    expect(result.current.timings).toBe(before);
  });
});

import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { USER_DEFINED_TREE_NAME } from '../../notificationPolicies/routingTree.utils';
import { TIMING_DEFAULTS } from '../constants';

import { useInheritedRoutingTimings } from './useInheritedRoutingTimings';

const server = setupMockServer();

describe('useInheritedRoutingTimings', () => {
  it('uses the built-in defaults while the default policy loads, then its timings, keeping defaults for unset ones', async () => {
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

    expect(result.current).toEqual(TIMING_DEFAULTS);
    await waitFor(() => expect(result.current.groupWait).toBe('45s'));
    expect(result.current.groupInterval).toBe(TIMING_DEFAULTS.groupInterval);
  });
});

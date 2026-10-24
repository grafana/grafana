import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Provider } from 'react-redux';

import { MockBackendSrv } from '@grafana/api-clients';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { convertAPI } from '../../convert/api/client';
import { useRoutingTrees } from '../notificationPolicies/hooks/useRoutingTrees';

import { ListRoutingTreeApiResponseFactory, RoutingTreeFactory } from './notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from './notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { createAlertingStore } from './store';

// @ts-ignore
setBackendSrv(new MockBackendSrv());

const server = setupMockServer();

describe('createAlertingStore', () => {
  it("is enough on its own for the package's hooks to fetch data", async () => {
    const tree = RoutingTreeFactory.build({ metadata: { name: 'team-a' } });
    server.use(listRoutingTreeHandler(ListRoutingTreeApiResponseFactory.build({ items: [tree] })));

    const store = createAlertingStore();
    const { result } = renderHook(() => useRoutingTrees(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.trees.map((t) => t.metadata.name)).toEqual(['team-a']);
  });

  it('adds the API clients it is given, so they share the store', async () => {
    server.use(http.get('/api/convert/prometheus/config/v1/rules', () => HttpResponse.json({ ns: [] })));

    const store = createAlertingStore([convertAPI]);
    const rules = await store.dispatch(convertAPI.endpoints.getRules.initiate()).unwrap();

    expect(rules).toEqual({ ns: [] });
    expect(store.getState()).toHaveProperty(convertAPI.reducerPath);
  });
});

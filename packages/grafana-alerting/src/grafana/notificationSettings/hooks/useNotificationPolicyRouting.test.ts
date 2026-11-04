import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { USER_DEFINED_TREE_NAME } from '../../notificationPolicies/routingTree.utils';

import { useNotificationPolicyRouting } from './useNotificationPolicyRouting';

const server = setupMockServer();

const defaultTree = RoutingTreeFactory.build({ metadata: { name: USER_DEFINED_TREE_NAME } });
const namedTree = RoutingTreeFactory.build({ metadata: { name: 'deployment-tools' } });

function serveTrees(...items: Array<ReturnType<typeof RoutingTreeFactory.build>>) {
  server.use(listRoutingTreeHandler(ListRoutingTreeApiResponseFactory.build({ items })));
}

beforeEach(() => {
  serveTrees(defaultTree, namedTree);
});

function renderState(name?: string) {
  return renderHook(() => useNotificationPolicyRouting(name), { wrapper: getDefaultWrapper() });
}

describe('selected tree', () => {
  it('is the default policy for no name', async () => {
    const { result } = renderState();

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: USER_DEFINED_TREE_NAME, isDefault: true });
    expect(result.current.isValid).toBe(true);
  });

  it('is the named tree', async () => {
    const { result } = renderState('deployment-tools');

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: 'deployment-tools', isDefault: false });
    expect(result.current.isValid).toBe(true);
  });

  it('is resolving, and still valid, until the trees have loaded', async () => {
    const { result } = renderState('deployment-tools');

    expect(result.current).toMatchObject({ status: 'resolving', tree: null, isValid: true });
    await waitFor(() => expect(result.current.status).toBe('found'));
  });

  it('is not found, and invalid, when the named tree no longer exists', async () => {
    const { result } = renderState('deleted-tree');

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(false);
  });

  it('finds the default policy under its alias', async () => {
    const { result } = renderState('default');

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: USER_DEFINED_TREE_NAME, isDefault: true });
  });

  it('does not treat a list without the default policy as a missing tree', async () => {
    serveTrees(namedTree);
    const { result } = renderState();

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(true);
  });

  it('reports a failed fetch, and stays valid because nothing is known about the tree', async () => {
    server.use(listRoutingTreeHandler(() => new HttpResponse(null, { status: 500 })));
    const { result } = renderState('deployment-tools');

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(true);
  });
});

describe('isValid', () => {
  it.each(['', 'user-defined', 'default'])(
    'is false for the default policy named explicitly as %p, which the backend rejects as a named policy',
    async (name) => {
      const { result } = renderState(name);

      await waitFor(() => expect(result.current.status).toBe('found'));
      expect(result.current.tree).toMatchObject({ isDefault: true });
      expect(result.current.isValid).toBe(false);
    }
  );

  it('is false for an explicit default name even before the trees have loaded', () => {
    const { result } = renderState('user-defined');

    expect(result.current).toMatchObject({ status: 'resolving', isValid: false });
  });
});

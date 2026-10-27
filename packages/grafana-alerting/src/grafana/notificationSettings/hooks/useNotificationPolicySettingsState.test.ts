import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { USER_DEFINED_TREE_NAME } from '../../notificationPolicies/routingTree.utils';
import { routingTreesErrorScenario } from '../notificationSettings.scenario';
import { type PolicyRoutingSettings, policyRouting } from '../notificationSettingsValue';

import { useNotificationPolicySettingsState } from './useNotificationPolicySettingsState';

const server = setupMockServer();

const defaultTree = RoutingTreeFactory.build({ metadata: { name: USER_DEFINED_TREE_NAME } });
const namedTree = RoutingTreeFactory.build({ metadata: { name: 'deployment-tools' } });
const instances: Array<Array<[string, string]>> = [[['severity', 'critical']]];

function serveTrees(...items: Array<ReturnType<typeof RoutingTreeFactory.build>>) {
  server.use(listRoutingTreeHandler(ListRoutingTreeApiResponseFactory.build({ items })));
}

beforeEach(() => {
  serveTrees(defaultTree, namedTree);
});

function renderState(value: PolicyRoutingSettings | null, withInstances = false) {
  return renderHook(
    () => useNotificationPolicySettingsState({ value, instances: withInstances ? instances : undefined }),
    {
      wrapper: getDefaultWrapper(),
    }
  );
}

describe('selected tree', () => {
  it('is the default policy for no value', async () => {
    const { result } = renderState(null);

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: USER_DEFINED_TREE_NAME, isDefault: true });
    expect(result.current.isValid).toBe(true);
  });

  it('is the named tree', async () => {
    const { result } = renderState(policyRouting('deployment-tools'));

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: 'deployment-tools', isDefault: false });
    expect(result.current.isValid).toBe(true);
  });

  it('is resolving, and still valid, until the trees have loaded', async () => {
    const { result } = renderState(policyRouting('deployment-tools'));

    expect(result.current).toMatchObject({ status: 'resolving', tree: null, isValid: true });
    await waitFor(() => expect(result.current.status).toBe('found'));
  });

  it('is not found, and invalid, when the named tree no longer exists', async () => {
    const { result } = renderState(policyRouting('deleted-tree'));

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(false);
  });

  it('finds the default policy under its alias', async () => {
    const { result } = renderState(policyRouting('default'));

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toMatchObject({ name: USER_DEFINED_TREE_NAME, isDefault: true });
  });

  it('does not treat a list without the default policy as a missing tree', async () => {
    serveTrees(namedTree);
    const { result } = renderState(null);

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(true);
  });

  it('reports a failed fetch, and stays valid because nothing is known about the tree', async () => {
    server.use(...routingTreesErrorScenario);
    const { result } = renderState(policyRouting('deployment-tools'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.tree).toBeNull();
    expect(result.current.isValid).toBe(true);
  });
});

describe('preview', () => {
  it('is not requested without instances', async () => {
    const { result } = renderState(policyRouting('deployment-tools'));

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.previewRoutes).toBeNull();
  });

  it('lists the receivers of the named tree that match the instances', async () => {
    const { result } = renderState(policyRouting('deployment-tools'), true);

    await waitFor(() => expect(result.current.previewRoutes).not.toBeNull());
    expect(result.current.previewRoutes?.map((route) => route.receiver)).toContain(namedTree.spec.defaults.receiver);
  });

  it('previews the default policy for no value', async () => {
    const { result } = renderState(null, true);

    await waitFor(() => expect(result.current.previewRoutes).not.toBeNull());
    expect(result.current.previewRoutes?.map((route) => route.receiver)).toContain(defaultTree.spec.defaults.receiver);
  });

  it('keeps the same routes reference while nothing changes', async () => {
    const { result, rerender } = renderState(policyRouting('deployment-tools'), true);
    await waitFor(() => expect(result.current.previewRoutes).not.toBeNull());
    const routes = result.current.previewRoutes;

    rerender();

    expect(result.current.previewRoutes).toBe(routes);
  });

  it('is unknown, not empty, for a tree that no longer exists', async () => {
    const { result } = renderState(policyRouting('deleted-tree'), true);

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.previewRoutes).toBeNull();
  });
});

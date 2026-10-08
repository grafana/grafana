import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import { act, renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper, store } from '../../../../tests/provider';
import { notificationsAPI } from '../../api/notifications';
import {
  routingTreeWithErrorScenario,
  simpleRoutingTreesList,
  simpleRoutingTreesListScenario,
} from '../components/RoutingTreeSelector/RoutingTreeSelector.scenario';

import { useResolvedRoutingTree } from './useResolvedRoutingTree';
import { useRoutingTrees } from './useRoutingTrees';

const server = setupMockServer();

const [defaultTree] = simpleRoutingTreesList.items;

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

function renderResolved(name?: string) {
  return renderHook(() => useResolvedRoutingTree(name), { wrapper: getDefaultWrapper() });
}

describe('useResolvedRoutingTree', () => {
  it('resolves a tree by name', async () => {
    const { result } = renderResolved('team-platform');

    expect(result.current.isResolving).toBe(true);
    await waitFor(() => expect(result.current.tree?.metadata.name).toBe('team-platform'));
    expect(result.current.isResolving).toBe(false);
    expect(result.current.isNotFound).toBe(false);
  });

  it('reports a name that matches no tree as not found', async () => {
    const { result } = renderResolved('deleted-tree');

    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.tree).toBeNull();
    expect(result.current.isResolving).toBe(false);
  });

  it.each([undefined, '', 'user-defined'])('resolves the default tree for the name %p', async (name) => {
    const { result } = renderResolved(name);

    expect(result.current.isResolving).toBe(true);
    await waitFor(() => expect(result.current.tree?.metadata.name).toBe(defaultTree.metadata.name));
    expect(result.current.isResolving).toBe(false);
    expect(result.current.isNotFound).toBe(false);
  });

  it('reports a failed fetch as an error rather than not found', async () => {
    server.use(...routingTreeWithErrorScenario);

    const { result } = renderResolved('team-platform');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
  });

  it('keeps the resolved tree, without an error, when a later refetch fails', async () => {
    // useRoutingTrees shares the cache entry, so its status tells us when the failed refetch has landed.
    const { result } = renderHook(
      () => ({ resolved: useResolvedRoutingTree('team-platform'), list: useRoutingTrees() }),
      {
        wrapper: getDefaultWrapper(),
      }
    );
    await waitFor(() => expect(result.current.resolved.tree?.metadata.name).toBe('team-platform'));

    server.use(...routingTreeWithErrorScenario);
    // The shared test store is typed without its thunk middleware, so tell TypeScript dispatch accepts a thunk.
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listRoutingTree.initiate({}, { forceRefetch: true }));
    });

    await waitFor(() => expect(result.current.list.isError).toBe(true));
    expect(result.current.resolved.tree?.metadata.name).toBe('team-platform');
    expect(result.current.resolved.isError).toBe(false);
  });
});

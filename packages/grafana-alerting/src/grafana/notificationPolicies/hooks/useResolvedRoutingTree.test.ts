import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  routingTreeWithErrorScenario,
  simpleRoutingTreesListScenario,
} from '../components/RoutingTreeSelector/RoutingTreeSelector.scenario';

import { useResolvedRoutingTree } from './useResolvedRoutingTree';

const server = setupMockServer();

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

  it('has no tree, and nothing to resolve, when no name is given', async () => {
    const { result } = renderResolved(undefined);

    expect(result.current).toMatchObject({ tree: null, isResolving: false, isNotFound: false });
  });

  it('reports a failed fetch as an error rather than not found', async () => {
    server.use(...routingTreeWithErrorScenario);

    const { result } = renderResolved('team-platform');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
  });
});

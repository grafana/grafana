import { renderHook, waitFor } from '@testing-library/react';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  routingTreeWithErrorScenario,
  simpleRoutingTreesList,
  simpleRoutingTreesListDefaultAlias,
  simpleRoutingTreesListDefaultAliasScenario,
  simpleRoutingTreesListScenario,
} from '../components/RoutingTreeSelector/RoutingTreeSelector.scenario';
import * as routeUtils from '../route.utils';

import { type NotificationPolicyPreviewResult, useNotificationPolicyPreview } from './useNotificationPolicyPreview';
import { useRoutingTrees } from './useRoutingTrees';

const server = setupMockServer();

const instances = [[['severity', 'critical']]] as Array<Array<[string, string]>>;

const matchedReceivers = ({ results }: NotificationPolicyPreviewResult) =>
  results.flatMap(({ matchedRoutes }) => matchedRoutes.map(({ receiver }) => receiver));
const [defaultTree, namedTree] = simpleRoutingTreesList.items;

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

// useRoutingTrees shares the list request with the hook under test, so its status tells us the fetch has settled.
function renderPreview(name?: string) {
  return renderHook(() => ({ preview: useNotificationPolicyPreview(name, instances), list: useRoutingTrees() }), {
    wrapper: getDefaultWrapper(),
  });
}

describe('useNotificationPolicyPreview', () => {
  it('returns the routes of the named tree that match the instances', async () => {
    const { result } = renderPreview(namedTree.metadata.name);

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    expect(matchedReceivers(result.current.preview)).toContain(namedTree.spec.defaults.receiver);
  });

  it('returns one result per instance, with the match details and the tree it matched in', async () => {
    const { result } = renderPreview(namedTree.metadata.name);

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    const [match] = result.current.preview.results;
    expect(result.current.preview.results).toHaveLength(instances.length);
    expect(match.labels).toBe(instances[0]);
    expect(match.matchedRoutes).not.toHaveLength(0);
    expect(match.matchedRoutes[0].treeName).toBe(namedTree.metadata.name);
    expect(match.matchedRoutes[0].matchingJourney).not.toHaveLength(0);
  });

  it('exposes only the view fields, not the matcher internals', async () => {
    const { result } = renderPreview(namedTree.metadata.name);

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    const [{ matchedRoutes }] = result.current.preview.results;
    matchedRoutes.forEach((match) => {
      expect(Object.keys(match).sort()).toEqual(['matchingJourney', 'receiver', 'treeName']);
      match.matchingJourney.forEach((step) => {
        expect(Object.keys(step).sort()).toEqual(['matchDetails', 'route']);
        expect(Object.keys(step.route).sort()).toEqual(['continue', 'group_by', 'matchers', 'receiver']);
      });
    });
  });

  it('keeps the same results reference while nothing changes', async () => {
    const { result, rerender } = renderPreview(namedTree.metadata.name);
    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    const { results } = result.current.preview;

    rerender();

    expect(result.current.preview.results).toBe(results);
  });

  it.each([undefined, '', 'user-defined'])('previews the default policy for the name %p', async (name) => {
    const { result } = renderPreview(name);

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    expect(matchedReceivers(result.current.preview)).toContain(defaultTree.spec.defaults.receiver);
  });

  it('previews the default policy when the backend names it with the `default` alias', async () => {
    server.use(...simpleRoutingTreesListDefaultAliasScenario);

    const { result } = renderPreview('default');

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    expect(matchedReceivers(result.current.preview)).toContain(
      simpleRoutingTreesListDefaultAlias.items[0].spec.defaults.receiver
    );
  });

  it('is resolving, with no routes, while the tree list is loading', () => {
    const { result } = renderPreview(namedTree.metadata.name);

    expect(result.current.list.isLoading).toBe(true);
    expect(result.current.preview).toEqual({ status: 'resolving', results: [] });
  });

  it('is not found, rather than falling back to the default policy, for a tree that does not exist', async () => {
    const { result } = renderPreview('deleted-tree');

    await waitFor(() => expect(result.current.preview.status).toBe('notFound'));
    expect(result.current.preview.results).toEqual([]);
  });

  it.each([undefined, 'team-platform'])('is an error when the list cannot be loaded (name %p)', async (name) => {
    server.use(...routingTreeWithErrorScenario);

    const { result } = renderPreview(name);

    await waitFor(() => expect(result.current.preview.status).toBe('error'));
    expect(result.current.preview.results).toEqual([]);
    expect(result.current.preview.error).toBeDefined();
  });

  it('has no error while the tree list loads fine', async () => {
    const { result } = renderPreview(namedTree.metadata.name);

    await waitFor(() => expect(result.current.preview.status).toBe('found'));
    expect(result.current.preview.error).toBeUndefined();
  });

  it('does not match the tree when there are no instances to match', async () => {
    const matchSpy = jest.spyOn(routeUtils, 'matchInstancesToRoute');
    const { result } = renderHook(() => useNotificationPolicyPreview(namedTree.metadata.name, []), {
      wrapper: getDefaultWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.results).toEqual([]);
    expect(matchSpy).not.toHaveBeenCalled();
    matchSpy.mockRestore();
  });
});

import { API_VERSION, type RoutingTree } from '../../api/notifications';
import { LabelMatcherFactory, RouteFactory } from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import { type Label } from '../../matchers/types';

import { matchInstancesToRouteTrees } from './useMatchPolicies';

describe('matchInstancesToRouteTrees', () => {
  it('should return root route when child routes do not match instances', () => {
    const route = RouteFactory.build({
      matchers: [LabelMatcherFactory.build({ label: 'service', type: '=', value: 'web' })],
      receiver: 'web-team',
    });

    const treeName = 'test-tree';
    const trees: RoutingTree[] = [
      {
        kind: 'RoutingTree',
        apiVersion: API_VERSION,
        metadata: { name: treeName },
        spec: {
          defaults: {
            receiver: 'receiver 1',
          },
          routes: [route],
        },
      },
    ];

    const instanceLabels: Label[] = [['service', 'api']];
    const instances: Label[][] = [instanceLabels]; // Different service - should not match

    const result = matchInstancesToRouteTrees(trees, instances);

    expect(result).toHaveLength(1);
    expect(result[0].labels).toBe(instanceLabels);
    expect(result[0].matchedRoutes).toHaveLength(1);
    // The root route should match as it's a catch-all
    expect(result[0].matchedRoutes[0].route.receiver).toBe('receiver 1');
    expect(result[0].matchedRoutes[0].routeTree.metadata.name).toBe(treeName);
  });

  it('should return matched routes when trees match instances', () => {
    const route = RouteFactory.build({
      matchers: [LabelMatcherFactory.build({ label: 'service', type: '=', value: 'web' })],
      receiver: 'web-team',
    });

    const treeName = 'test-tree';
    const trees: RoutingTree[] = [
      {
        kind: 'RoutingTree',
        apiVersion: API_VERSION,
        metadata: { name: treeName },
        spec: {
          defaults: {
            receiver: 'receiver 1',
          },
          routes: [route],
        },
      },
    ];

    const instanceLabels: Label[] = [['service', 'web']];
    const instances: Label[][] = [instanceLabels];

    const result = matchInstancesToRouteTrees(trees, instances);

    expect(result).toHaveLength(1);
    expect(result[0].labels).toBe(instanceLabels);
    expect(result[0].matchedRoutes.length).toBeGreaterThan(0);
    expect(result[0].matchedRoutes[0].routeTree.metadata.name).toBe(treeName);
    expect(result[0].matchedRoutes[0].matchDetails.labels).toBe(instanceLabels);
  });

  it('should give each instance only its own matches, from every tree in order', () => {
    const buildTree = (name: string, service: string, receiver: string): RoutingTree => ({
      kind: 'RoutingTree',
      apiVersion: API_VERSION,
      metadata: { name },
      spec: {
        defaults: { receiver: `${name}-default` },
        routes: [
          RouteFactory.build({
            matchers: [LabelMatcherFactory.build({ label: 'service', type: '=', value: service })],
            receiver,
            routes: [],
          }),
        ],
      },
    });
    const trees = [buildTree('tree-a', 'web', 'web-a'), buildTree('tree-b', 'web', 'web-b')];
    const web: Label[] = [['service', 'web']];
    const api: Label[] = [['service', 'api']];

    const result = matchInstancesToRouteTrees(trees, [web, api]);

    const summary = result.map(({ labels, matchedRoutes }) => ({
      labels,
      matches: matchedRoutes.map(({ route, routeTree }) => [routeTree.metadata.name, route.receiver]),
    }));
    expect(summary).toEqual([
      {
        labels: web,
        matches: [
          ['tree-a', 'web-a'],
          ['tree-b', 'web-b'],
        ],
      },
      {
        labels: api,
        matches: [
          ['tree-a', 'tree-a-default'],
          ['tree-b', 'tree-b-default'],
        ],
      },
    ]);
    result.forEach(({ labels, matchedRoutes }) =>
      matchedRoutes.forEach(({ matchDetails }) => expect(matchDetails.labels).toBe(labels))
    );
  });
});

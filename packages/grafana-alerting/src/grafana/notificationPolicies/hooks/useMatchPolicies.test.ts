import { VERSION } from '../../api/notifications/v0alpha1/const';
import { LabelMatcherFactory, RouteFactory } from '../../api/notifications/v0alpha1/mocks/fakes/Routes';
import { RoutingTree } from '../../api/notifications/v0alpha1/notifications.api.gen';
import { Label } from '../../matchers/types';

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
        apiVersion: VERSION,
        metadata: { name: treeName },
        spec: {
          defaults: {
            receiver: 'receiver 1',
          },
          routes: [route],
        },
        status: {},
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
        apiVersion: VERSION,
        metadata: { name: treeName },
        spec: {
          defaults: {
            receiver: 'receiver 1',
          },
          routes: [route],
        },
        status: {},
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
});

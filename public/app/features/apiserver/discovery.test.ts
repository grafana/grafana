import { type APIGroupDiscoveryList, type GroupDiscoveryResource, discoveryResources } from './discovery';

const discoverySnapshot = require('./snapshots/discovery-snapshot.json');

describe('simple typescript tests', () => {
  it('simple', async () => {
    const watchable = discoveryResources(discoverySnapshot)
      .filter((v) => v.verbs.includes('watch'))
      .map((v) => v.resource);
    expect(watchable).toEqual(['user-storage', 'dashboards', 'dashboards', 'dashboards']);
  });

  it('skips versions without resources', () => {
    const resource: GroupDiscoveryResource = {
      resource: 'dashboards',
      responseKind: { group: 'dashboard.grafana.app', version: 'v1alpha1', kind: 'Dashboard' },
      scope: 'Namespaced',
      singularResource: 'dashboard',
      verbs: ['get'],
    };
    const apis: APIGroupDiscoveryList = {
      metadata: { resourceVersion: '' },
      items: [
        {
          metadata: { name: 'dashboard.grafana.app' },
          versions: [
            // The apiserver omits the field entirely for versions with no resources
            { version: 'v2alpha1', freshness: 'Current' },
            { version: 'v1alpha1', freshness: 'Current', resources: [resource] },
          ],
        },
      ],
    };

    expect(discoveryResources(apis)).toEqual([resource]);
  });
});

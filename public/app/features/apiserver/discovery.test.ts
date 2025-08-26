import { discoveryResources } from './discovery';

const discoverySnapshot = require('./snapshots/discovery-snapshot.json');

describe('simple typescript tests', () => {
  it('simple', async () => {
    const watchable = discoveryResources(discoverySnapshot)
      .filter((v) => v.verbs.includes('watch'))
      .map((v) => v.resource);
    expect(watchable).toEqual(['user-storage', 'dashboards', 'dashboards', 'dashboards']);
  });
});

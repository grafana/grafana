import { type AppManifestKind } from 'app/features/apiserver/appManifests';

import { getManifestKinds } from './manifestKinds';

const mockAppManifestKinds: AppManifestKind[] = [];
jest.mock('app/features/apiserver/appManifests', () => ({
  ...jest.requireActual('app/features/apiserver/appManifests'),
  getAppManifestKinds: () => mockAppManifestKinds,
}));

describe('getManifestKinds', () => {
  afterEach(() => mockAppManifestKinds.splice(0, mockAppManifestKinds.length));

  it('names a kind after its kind and plural without a translation, and links its resources', () => {
    mockAppManifestKinds.push({
      appName: 'example-app',
      group: 'example.ext.grafana.app',
      kind: 'Widget',
      plural: 'Widgets',
      resource: 'widgets',
      labelKey: 'kinds.widget',
      url: '/a/example-app/widgets/{name}',
      icon: 'apps',
    });

    const [kind] = getManifestKinds();

    expect(kind).toMatchObject({
      group: 'example.ext.grafana.app',
      kind: 'Widget',
      resource: 'widgets',
      label: 'Widget',
      pluralLabel: 'Widgets',
      icon: 'apps',
    });
    expect(kind.getRoute?.('a')).toBe('/a/example-app/widgets/a');
  });

  it('uses the file icon for an unknown icon, and gives no route without a url', () => {
    mockAppManifestKinds.push({
      appName: 'example-app',
      group: 'example.ext.grafana.app',
      kind: 'Widget',
      plural: 'Widgets',
      resource: 'widgets',
      icon: 'not-an-icon',
    });

    const [kind] = getManifestKinds();

    expect(kind.icon).toBe('file-alt');
    expect(kind.getRoute).toBeUndefined();
  });
});

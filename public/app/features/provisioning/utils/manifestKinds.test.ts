import { getManifestKinds, setManifestKinds } from './manifestKinds';

describe('setManifestKinds', () => {
  afterEach(() => setManifestKinds([]));

  it('keeps the active resources that an app manifest declares', () => {
    setManifestKinds([
      { group: 'example.ext.grafana.app', kind: 'Widget', resource: 'widgets', label: 'Widget', icon: 'apps' },
      { group: 'example.ext.grafana.app', kind: 'Gadget', resource: 'gadgets', disabled: true },
      { group: 'dashboard.grafana.app', kind: 'LibraryPanel' },
    ]);

    expect(getManifestKinds()).toEqual([
      {
        group: 'example.ext.grafana.app',
        kind: 'Widget',
        resource: 'widgets',
        label: 'Widget',
        pluralLabel: 'Widget',
        icon: 'apps',
      },
    ]);
  });

  it('defaults the labels to the kind and an unknown icon to the file icon', () => {
    setManifestKinds([{ group: 'example.ext.grafana.app', kind: 'Widget', resource: 'widgets', icon: 'not-an-icon' }]);

    expect(getManifestKinds()).toEqual([
      {
        group: 'example.ext.grafana.app',
        kind: 'Widget',
        resource: 'widgets',
        label: 'Widget',
        pluralLabel: 'Widget',
        icon: 'file-alt',
      },
    ]);
  });
});

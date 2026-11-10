import { getBackendSrv } from '@grafana/runtime';

import { getAppManifestKindLabel, getAppManifestKinds, loadAppManifestKinds } from './appManifests';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('loadAppManifestKinds', () => {
  it('reads each kind once, from the preferred version first, with its ui extension', async () => {
    const get = jest.fn().mockResolvedValue({
      items: [
        {
          spec: {
            appName: 'example-app',
            group: 'example.ext.grafana.app',
            preferredVersion: 'v2',
            versions: [
              { name: 'v1', kinds: [{ kind: 'Widget', plural: 'Widgets', resource: 'widgets' }] },
              {
                name: 'v2',
                kinds: [
                  {
                    kind: 'Widget',
                    plural: 'Widgets',
                    resource: 'widgets',
                    extensions: {
                      ui: { labelKey: 'kinds.widget', icon: 'apps', url: '/a/example-app/widgets/{name}' },
                    },
                  },
                  { kind: 'Gadget' },
                ],
              },
            ],
          },
        },
      ],
    });
    jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);

    const kinds = await loadAppManifestKinds();
    await loadAppManifestKinds();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/apis/discovery/v1alpha2/manifests', undefined, undefined, {
      showErrorAlert: false,
    });
    expect(kinds).toEqual([
      {
        appName: 'example-app',
        group: 'example.ext.grafana.app',
        kind: 'Widget',
        plural: 'Widgets',
        resource: 'widgets',
        labelKey: 'kinds.widget',
        icon: 'apps',
        url: '/a/example-app/widgets/{name}',
      },
      {
        appName: 'example-app',
        group: 'example.ext.grafana.app',
        kind: 'Gadget',
        plural: 'Gadgets',
        resource: 'gadgets',
      },
    ]);
    expect(getAppManifestKinds()).toBe(kinds);
  });
});

describe('getAppManifestKindLabel', () => {
  const kind = {
    appName: 'example-app',
    group: 'example.ext.grafana.app',
    kind: 'Widget',
    plural: 'Widgets',
    resource: 'widgets',
  };

  it('falls back to the kind for one resource and to the plural for other counts', () => {
    expect(getAppManifestKindLabel(kind, 1)).toBe('Widget');
    expect(getAppManifestKindLabel(kind, 2)).toBe('Widgets');
    expect(getAppManifestKindLabel({ ...kind, labelKey: 'kinds.widget' }, 2)).toBe('Widgets');
  });
});

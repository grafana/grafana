import { type OpenAPIV3 } from 'openapi-types';

import { groupVersion, includeEndpoint, restoreClusterPaths } from './lib';
import { reducerPath } from './templates';

const doc = (paths: string[]) => ({ paths: Object.fromEntries(paths.map((p) => [p, {}])) }) as OpenAPIV3.Document;

describe('groupVersion', () => {
  it('reads the group and version from the first /apis/ path', () => {
    expect(
      groupVersion(doc(['/apis/appsdktest.ext.grafana.app/v1alpha1/namespaces/{namespace}/testresources']), 'x.json')
    ).toEqual({
      group: 'appsdktest.ext.grafana.app',
      version: 'v1alpha1',
    });
  });

  it('falls back to the <group>-<version>.json filename', () => {
    expect(groupVersion(doc(['/']), 'appsdktest.ext.grafana.app-v0alpha1.json')).toEqual({
      group: 'appsdktest.ext.grafana.app',
      version: 'v0alpha1',
    });
  });
});

describe('includeEndpoint', () => {
  it('keeps everything but the per-kind search and trash routes, like the clients in this package', () => {
    expect(includeEndpoint('/')).toBe(true);
    expect(includeEndpoint('/app/instance')).toBe(true);
    expect(includeEndpoint('/testresources')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/status')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/bar')).toBe(true);
    expect(includeEndpoint('/testresources/search')).toBe(false);
    expect(includeEndpoint('/testresources/trash')).toBe(false);
  });
});

describe('reducerPath', () => {
  it('matches the convention used by the clients in this package', () => {
    expect(reducerPath('playlist.grafana.app', 'v1')).toBe('playlistAPIv1');
    expect(reducerPath('notifications.alerting.grafana.app', 'v0alpha1')).toBe('notificationsAlertingAPIv0alpha1');
    expect(reducerPath('appsdktest.ext.grafana.app', 'v1alpha1')).toBe('appsdktestExtAPIv1alpha1');
  });
});

describe('restoreClusterPaths', () => {
  it('leaves namespaced paths relative and makes everything else absolute', () => {
    const raw = doc([
      '/apis/g/v1/',
      '/apis/g/v1/foo',
      '/apis/g/v1/namespaces/{namespace}/bookmarks',
      '/apis/g/v1/namespaces/{namespace}/bookmarks/{name}/visit',
    ]);
    const processed = doc(['/', '/foo', '/bookmarks', '/bookmarks/{name}/visit']);

    expect(Object.keys(restoreClusterPaths(processed, raw, 'g', 'v1').paths).sort()).toEqual([
      '/apis/g/v1/',
      '/apis/g/v1/foo',
      '/bookmarks',
      '/bookmarks/{name}/visit',
    ]);
  });
});

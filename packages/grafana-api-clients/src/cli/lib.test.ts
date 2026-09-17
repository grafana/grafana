import { type OpenAPIV3 } from 'openapi-types';

import { groupVersion, includeEndpoint, isSettingsOnly } from './lib';
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

describe('isSettingsOnly', () => {
  it('is true for the settings-only version every app plugin serves', () => {
    expect(isSettingsOnly(doc(['/', '/app/instance', '/app/instance/health', '/app/instance/resources']))).toBe(true);
  });

  it('is false once a kind is served', () => {
    expect(isSettingsOnly(doc(['/', '/app/instance', '/testresources']))).toBe(false);
  });
});

describe('includeEndpoint', () => {
  it('keeps kind, subresource and custom route endpoints', () => {
    expect(includeEndpoint('/testresources')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/status')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/bar')).toBe(true);
    expect(includeEndpoint('/foo')).toBe(true);
  });

  it('drops discovery, settings and per-kind search/trash', () => {
    expect(includeEndpoint('/')).toBe(false);
    expect(includeEndpoint('/app/instance')).toBe(false);
    expect(includeEndpoint('/app/instance/health')).toBe(false);
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

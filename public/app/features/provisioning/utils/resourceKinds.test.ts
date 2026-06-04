import { config } from '@grafana/runtime';

import {
  findResourceKind,
  getEnabledResourceKinds,
  getResourceIcon,
  getResourceKindByKind,
  getResourceLabel,
  getResourceListUrl,
  isResourceKindEnabled,
  resolveResourceKind,
} from './resourceKinds';

describe('findResourceKind', () => {
  it('matches strictly on group and resource', () => {
    expect(findResourceKind('dashboard.grafana.app', 'dashboards')?.kind).toBe('Dashboard');
    expect(findResourceKind('folder.grafana.app', 'folders')?.kind).toBe('Folder');
  });

  it('does not match an unknown resource within a known group', () => {
    expect(findResourceKind('dashboard.grafana.app', 'unknown-type')).toBeUndefined();
  });

  it('returns undefined when group or resource is missing', () => {
    expect(findResourceKind('dashboard.grafana.app')).toBeUndefined();
    expect(findResourceKind(undefined, 'dashboards')).toBeUndefined();
  });
});

describe('resolveResourceKind', () => {
  it('resolves an exact group + resource pair', () => {
    expect(resolveResourceKind('dashboard.grafana.app', 'dashboards')?.kind).toBe('Dashboard');
  });

  it('resolves by the full group alone (stats only carry the group)', () => {
    expect(resolveResourceKind('folder.grafana.app')?.kind).toBe('Folder');
  });

  it('resolves legacy stats where the plural resource is reported as the group', () => {
    expect(resolveResourceKind('folders')?.kind).toBe('Folder');
  });

  it('returns undefined for unknown kinds', () => {
    expect(resolveResourceKind('widget.grafana.app', 'widgets')).toBeUndefined();
  });
});

describe('getResourceKindByKind', () => {
  it('looks up by singular k8s kind', () => {
    expect(getResourceKindByKind('Folder')?.group).toBe('folder.grafana.app');
    expect(getResourceKindByKind('Dashboard')?.group).toBe('dashboard.grafana.app');
  });

  it('returns undefined for an unknown kind', () => {
    expect(getResourceKindByKind('Widget')).toBeUndefined();
  });
});

describe('getResourceListUrl', () => {
  it('routes folder-contained kinds to the repository folder when syncing to a folder', () => {
    const ctx = { repoName: 'my-repo', syncTarget: 'folder' as const };
    expect(getResourceListUrl('dashboard.grafana.app', 'dashboards', ctx)).toBe('/dashboards/f/my-repo');
    expect(getResourceListUrl('folder.grafana.app', 'folders', ctx)).toBe('/dashboards/f/my-repo');
  });

  it('routes folder-contained kinds to the dashboards listing for instance syncs', () => {
    const ctx = { repoName: 'my-repo', syncTarget: 'instance' as const };
    expect(getResourceListUrl('dashboard.grafana.app', 'dashboards', ctx)).toBe('/dashboards');
  });

  it('routes playlists to their own listing', () => {
    expect(getResourceListUrl('playlist.grafana.app', 'playlists', { repoName: 'my-repo', syncTarget: 'folder' })).toBe(
      '/playlists'
    );
  });

  it('falls back gracefully for unknown kinds', () => {
    const ctx = { repoName: 'my-repo', syncTarget: 'folder' as const };
    expect(getResourceListUrl('widget.grafana.app', 'widgets', ctx)).toBe('/dashboards/f/my-repo');
  });
});

describe('getResourceLabel', () => {
  it('returns the localized plural label for known kinds', () => {
    expect(getResourceLabel('dashboard.grafana.app', 'dashboards')).toBe('Dashboards');
    expect(getResourceLabel('folder.grafana.app', 'folders')).toBe('Folders');
  });

  it('falls back to the raw resource string for unknown kinds', () => {
    expect(getResourceLabel('widget.grafana.app', 'widgets')).toBe('widgets');
  });
});

describe('getResourceIcon', () => {
  it('returns the descriptor icon for known kinds', () => {
    expect(getResourceIcon('dashboard.grafana.app', 'dashboards')).toBe('apps');
    expect(getResourceIcon('folder.grafana.app', 'folders')).toBe('folder');
  });

  it('falls back to a generic file icon for unknown kinds', () => {
    expect(getResourceIcon('widget.grafana.app', 'widgets')).toBe('file-alt');
  });
});

describe('feature toggle gating', () => {
  const originalToggles = { ...config.featureToggles };

  afterEach(() => {
    config.featureToggles = { ...originalToggles };
  });

  it('treats core kinds without a toggle as always enabled', () => {
    const folders = findResourceKind('folder.grafana.app', 'folders')!;
    expect(isResourceKindEnabled(folders)).toBe(true);
  });

  it('gates toggled kinds on their feature toggle', () => {
    const playlists = findResourceKind('playlist.grafana.app', 'playlists')!;

    config.featureToggles.playlistsReconciler = false;
    expect(isResourceKindEnabled(playlists)).toBe(false);
    expect(getEnabledResourceKinds()).not.toContain(playlists);

    config.featureToggles.playlistsReconciler = true;
    expect(isResourceKindEnabled(playlists)).toBe(true);
    expect(getEnabledResourceKinds()).toContain(playlists);
  });
});

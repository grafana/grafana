import {
  findResourceKind,
  getResourceCountLabel,
  getResourceIcon,
  getResourceKindByKind,
  getResourceLabel,
  getResourceListUrl,
  getResourceViewUrl,
  isResourceItemType,
  resolveResourceKind,
} from './resourceKinds';

describe('findResourceKind', () => {
  it('matches strictly on group and resource', () => {
    expect(findResourceKind('dashboard.grafana.app', 'dashboards')?.kind).toBe('Dashboard');
    expect(findResourceKind('folder.grafana.app', 'folders')?.kind).toBe('Folder');
  });

  it('distinguishes kinds that share an API group by resource', () => {
    // dashboards and library panels both live under dashboard.grafana.app.
    expect(findResourceKind('dashboard.grafana.app', 'dashboards')?.kind).toBe('Dashboard');
    expect(findResourceKind('dashboard.grafana.app', 'librarypanels')?.kind).toBe('LibraryPanel');
  });

  it('does not match an unknown resource within a known group', () => {
    expect(findResourceKind('dashboard.grafana.app', 'unknown-type')).toBeUndefined();
  });

  it('returns undefined when group or resource is missing', () => {
    expect(findResourceKind('dashboard.grafana.app')).toBeUndefined();
    expect(findResourceKind(undefined, 'dashboards')).toBeUndefined();
  });
});

describe('isResourceItemType', () => {
  it('is true for resource-backed tree kinds and false for plain files', () => {
    expect(isResourceItemType('Folder')).toBe(true);
    expect(isResourceItemType('Dashboard')).toBe(true);
    expect(isResourceItemType('LibraryPanel')).toBe(true);
    expect(isResourceItemType('File')).toBe(false);
  });
});

describe('getResourceViewUrl', () => {
  it('routes to a single resource for kinds with a detail page', () => {
    expect(getResourceViewUrl('Dashboard', 'abc')).toBe('/d/abc');
    expect(getResourceViewUrl('Folder', 'abc')).toBe('/dashboards/f/abc');
  });

  it('returns undefined for kinds without a per-resource detail page', () => {
    expect(getResourceViewUrl('LibraryPanel', 'abc')).toBeUndefined();
    expect(getResourceViewUrl('File', 'abc')).toBeUndefined();
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

  it('distinguishes shared-group kinds when the resource is provided', () => {
    expect(resolveResourceKind('dashboard.grafana.app', 'librarypanels')?.kind).toBe('LibraryPanel');
  });

  it('resolves a group-only token to that group primary (first-declared) kind', () => {
    // The group alone is ambiguous (dashboards + library panels); the primary wins.
    expect(resolveResourceKind('dashboard.grafana.app')?.kind).toBe('Dashboard');
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

  it('routes library panels to their own listing', () => {
    expect(
      getResourceListUrl('dashboard.grafana.app', 'librarypanels', { repoName: 'my-repo', syncTarget: 'folder' })
    ).toBe('/library-panels');
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

describe('getResourceCountLabel', () => {
  it('interpolates count and the kind label from a single template', () => {
    expect(getResourceCountLabel(findResourceKind('dashboard.grafana.app', 'dashboards')!, 3)).toBe('3 Dashboards');
    expect(getResourceCountLabel(findResourceKind('folder.grafana.app', 'folders')!, 1)).toBe('1 Folders');
    expect(getResourceCountLabel(findResourceKind('dashboard.grafana.app', 'librarypanels')!, 2)).toBe(
      '2 Library panels'
    );
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

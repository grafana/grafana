import { getResourceIcon, getResourceLabel, getResourceListUrl, resolveResourceKind } from './resourceKinds';

describe('resourceKinds', () => {
  describe('resolveResourceKind', () => {
    it('resolves a known kind by group and resource', () => {
      expect(resolveResourceKind('dashboard.grafana.app', 'dashboards')?.resource).toBe('dashboards');
      expect(resolveResourceKind('playlist.grafana.app', 'playlists')?.resource).toBe('playlists');
    });

    it('resolves by resource alone (resource is the discriminator)', () => {
      expect(resolveResourceKind(undefined, 'folders')?.group).toBe('folder.grafana.app');
    });

    it('resolves by group alone when resource is missing', () => {
      expect(resolveResourceKind('dashboard.grafana.app', undefined)?.resource).toBe('dashboards');
    });

    it('returns undefined for unknown kinds', () => {
      expect(resolveResourceKind('unknown.grafana.app', 'widgets')).toBeUndefined();
      expect(resolveResourceKind(undefined, undefined)).toBeUndefined();
    });
  });

  describe('getResourceLabel', () => {
    it('returns the friendly label for a known kind', () => {
      expect(getResourceLabel('dashboard.grafana.app', 'dashboards')).toBe('Dashboards');
      expect(getResourceLabel('playlist.grafana.app', 'playlists')).toBe('Playlists');
    });

    it('falls back to the raw resource name for unknown kinds', () => {
      expect(getResourceLabel('unknown.grafana.app', 'widgets')).toBe('widgets');
    });

    it('falls back to an empty string when nothing is known', () => {
      expect(getResourceLabel(undefined, undefined)).toBe('');
    });
  });

  describe('getResourceIcon', () => {
    it('returns the kind icon for a known kind', () => {
      expect(getResourceIcon('folder.grafana.app', 'folders')).toBe('folder');
      expect(getResourceIcon('playlist.grafana.app', 'playlists')).toBe('presentation-play');
    });

    it('falls back to a generic icon for unknown kinds', () => {
      expect(getResourceIcon('unknown.grafana.app', 'widgets')).toBe('apps');
    });
  });

  describe('getResourceListUrl', () => {
    it('routes playlists to the playlists list regardless of sync target', () => {
      expect(getResourceListUrl('playlist.grafana.app', 'playlists', { repoName: 'repo', syncTarget: 'folder' })).toBe(
        '/playlists'
      );
    });

    it('routes folder-scoped kinds to the repository folder when syncing to a folder', () => {
      expect(
        getResourceListUrl('dashboard.grafana.app', 'dashboards', { repoName: 'repo', syncTarget: 'folder' })
      ).toBe('/dashboards/f/repo');
    });

    it('routes folder-scoped kinds to the dashboards list for non-folder targets', () => {
      expect(
        getResourceListUrl('dashboard.grafana.app', 'dashboards', { repoName: 'repo', syncTarget: 'instance' })
      ).toBe('/dashboards');
    });

    it('falls back to the folder/dashboards route for unknown kinds', () => {
      expect(getResourceListUrl('unknown.grafana.app', 'widgets', { repoName: 'repo', syncTarget: 'folder' })).toBe(
        '/dashboards/f/repo'
      );
      expect(getResourceListUrl(undefined, undefined, { syncTarget: 'instance' })).toBe('/dashboards');
    });
  });
});

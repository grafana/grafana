import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { createGrafanaLinkResolver } from './markdownResourceLinks';

function resource(overrides: Partial<ResourceListItem>): ResourceListItem {
  return { group: '', hash: '', name: '', path: '', resource: '', ...overrides };
}

describe('createGrafanaLinkResolver', () => {
  it('resolves a dashboard file to its in-app dashboard route', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'dashboards', name: 'abc', path: 'team-a/cpu.json' })],
      undefined
    );

    expect(resolve('team-a/cpu.json')).toBe('/d/abc');
  });

  it('resolves a folder directory link to its in-app folder route', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'folders', name: 'fold1', path: 'team-a' })],
      undefined
    );

    // Directory links carry a trailing slash from the markdown resolver.
    expect(resolve('team-a/')).toBe('/dashboards/f/fold1');
    expect(resolve('team-a')).toBe('/dashboards/f/fold1');
  });

  it('resolves a link to a folder _folder.json to the folder it describes', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'folders', name: 'fold1', path: 'team-a' })],
      undefined
    );

    expect(resolve('team-a/_folder.json')).toBe('/dashboards/f/fold1');
  });

  it('normalizes a trailing slash on the resource path', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'folders', name: 'fold1', path: 'team-a/' })],
      undefined
    );

    expect(resolve('team-a')).toBe('/dashboards/f/fold1');
  });

  it('resolves a playlist to its edit route', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'playlists', name: 'pl1', path: 'playlists/weekly.json' })],
      undefined
    );

    expect(resolve('playlists/weekly.json')).toBe('/playlists/edit/pl1');
  });

  it('returns undefined for kinds without a per-item route (library panels)', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'librarypanels', name: 'lp1', path: 'panels/graph.json' })],
      undefined
    );

    expect(resolve('panels/graph.json')).toBeUndefined();
  });

  it('returns undefined for a path with no synced resource', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'dashboards', name: 'abc', path: 'team-a/cpu.json' })],
      undefined
    );

    expect(resolve('team-a/notes.md')).toBeUndefined();
    expect(resolve('')).toBeUndefined();
  });

  it('resolves a root _folder.json link to the repository root folder', () => {
    // The root folder has an empty path; joined with the configured root it keys
    // at the configured root, which a root `_folder.json` link resolves to.
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'folders', name: 'root-folder', path: '' })],
      'dev/resources'
    );

    expect(resolve('dev/resources/_folder.json')).toBe('/dashboards/f/root-folder');
  });

  it('resolves a root _folder.json link when the repository has no configured path', () => {
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'folders', name: 'root-folder', path: '' })],
      undefined
    );

    expect(resolve('_folder.json')).toBe('/dashboards/f/root-folder');
  });

  it('matches an absolute (local repo) configured path against the leading-slash-stripped link', () => {
    // A `local` repo's configured root is an absolute filesystem path; the
    // rewriter strips the leading slash, so the resolver must too.
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'dashboards', name: 'abc', path: 'team-a/cpu.json' })],
      '/data/repo'
    );

    expect(resolve('data/repo/team-a/cpu.json')).toBe('/d/abc');
  });

  it('returns undefined when the matched resource has no name', () => {
    // A nameless entry would otherwise build a broken route like `/d/`.
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'dashboards', name: '', path: 'team-a/cpu.json' })],
      undefined
    );

    expect(resolve('team-a/cpu.json')).toBeUndefined();
  });

  it('does not match a non-metadata file against a root-keyed entry', () => {
    // A resource keyed at the repo root ("/") must not be returned for an
    // unrelated file whose folder-metadata fallback resolves to an empty dir.
    const resolve = createGrafanaLinkResolver([resource({ resource: 'folders', name: 'root', path: '/' })], undefined);

    expect(resolve('team-a/cpu.json')).toBeUndefined();
  });

  it('joins the repository configured path when matching resource paths', () => {
    // Resource paths from the API are relative to the configured root; the paths
    // passed to the resolver are full repo-root paths that include that prefix.
    const resolve = createGrafanaLinkResolver(
      [resource({ resource: 'dashboards', name: 'abc', path: 'team-a/cpu.json' })],
      'grafana'
    );

    expect(resolve('grafana/team-a/cpu.json')).toBe('/d/abc');
    expect(resolve('team-a/cpu.json')).toBeUndefined();
  });

  describe('markdown docs', () => {
    it('resolves a markdown doc to its containing folder page with a docTab param', () => {
      const resolve = createGrafanaLinkResolver(
        [resource({ resource: 'folders', name: 'fold1', path: 'team-a' })],
        undefined
      );

      expect(resolve('team-a/CONTRIBUTING.md')).toBe('/dashboards/f/fold1?docTab=CONTRIBUTING.md');
    });

    it('resolves a README in the repository root to the root folder page', () => {
      const resolve = createGrafanaLinkResolver(
        [resource({ resource: 'folders', name: 'root-folder', path: '' })],
        undefined
      );

      expect(resolve('README.md')).toBe('/dashboards/f/root-folder?docTab=README.md');
    });

    it('encodes a doc file name with spaces in the docTab param', () => {
      const resolve = createGrafanaLinkResolver(
        [resource({ resource: 'folders', name: 'fold1', path: 'team-a' })],
        undefined
      );

      expect(resolve('team-a/Release Notes.md')).toBe('/dashboards/f/fold1?docTab=Release%20Notes.md');
    });

    it('joins the configured repository path when resolving a doc folder', () => {
      const resolve = createGrafanaLinkResolver(
        [resource({ resource: 'folders', name: 'fold1', path: 'team-a' })],
        'grafana'
      );

      expect(resolve('grafana/team-a/SECURITY.md')).toBe('/dashboards/f/fold1?docTab=SECURITY.md');
    });

    it('returns undefined when the doc folder is not a synced folder', () => {
      // Only a dashboard is synced here; the doc's directory has no folder resource,
      // so the caller falls back to the host link.
      const resolve = createGrafanaLinkResolver(
        [resource({ resource: 'dashboards', name: 'abc', path: 'team-a/cpu.json' })],
        undefined
      );

      expect(resolve('team-a/NOTES.md')).toBeUndefined();
    });
  });
});

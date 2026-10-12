import { type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';

import { createGrafanaLinkResolver } from './markdownResourceLinks';

function resource(resource: string, name = 'synced-uid'): ResourceWrapper {
  const group =
    resource === 'folders'
      ? 'folder.grafana.app'
      : resource === 'playlists'
        ? 'playlist.grafana.app'
        : 'dashboard.grafana.app';
  return {
    repository: { name: 'test-repo', namespace: 'default', title: 'Test', type: 'github' },
    resource: {
      type: { group, resource },
      existing: { metadata: { name } },
      file: { metadata: { name: 'git-only-uid' } },
      dryRun: { metadata: { name: 'dry-run-uid' } },
    },
  };
}

describe('createGrafanaLinkResolver', () => {
  it.each([
    { link: 'team-a/cpu.json', path: 'team-a/cpu.json', kind: 'dashboards', route: '/d/synced-uid' },
    { link: 'team-a/cpu.yaml', path: 'team-a/cpu.yaml', kind: 'dashboards', route: '/d/synced-uid' },
    {
      link: 'playlists/weekly.json',
      path: 'playlists/weekly.json',
      kind: 'playlists',
      route: '/playlists/edit/synced-uid',
    },
    { link: 'team-a/', path: 'team-a/', kind: 'folders', route: '/dashboards/f/synced-uid' },
    { link: 'team-a/_folder.json', path: 'team-a/', kind: 'folders', route: '/dashboards/f/synced-uid' },
    {
      link: 'team-a/CONTRIBUTING.md',
      path: 'team-a/',
      kind: 'folders',
      route: '/dashboards/f/synced-uid?docTab=CONTRIBUTING.md',
    },
    {
      link: 'team-a/Release Notes.md',
      path: 'team-a/',
      kind: 'folders',
      route: '/dashboards/f/synced-uid?docTab=Release%20Notes.md',
    },
    { link: 'Team #1/a?b.json', path: 'Team%20%231/a%3Fb.json', kind: 'dashboards', route: '/d/synced-uid' },
  ])('resolves $link through the targeted files lookup to $route', async ({ link, path, kind, route }) => {
    const read = jest.fn().mockResolvedValue(resource(kind));
    const resolve = createGrafanaLinkResolver(read, undefined);

    await expect(resolve(link)).resolves.toBe(route);
    expect(read.mock.calls).toEqual([[{ path }]]);
  });

  it.each([
    {
      root: 'grafana',
      link: 'grafana/team-a/cpu.json',
      path: 'team-a/cpu.json',
      kind: 'dashboards',
      route: '/d/synced-uid',
    },
    {
      root: '/data/repo/',
      link: 'data/repo/team-a/cpu.json',
      path: 'team-a/cpu.json',
      kind: 'dashboards',
      route: '/d/synced-uid',
    },
    {
      root: 'grafana',
      link: 'grafana/team-a/SECURITY.md',
      path: 'team-a/',
      kind: 'folders',
      route: '/dashboards/f/synced-uid?docTab=SECURITY.md',
    },
  ])('strips the configured root $root from $link', async ({ root, link, path, kind, route }) => {
    const read = jest.fn().mockResolvedValue(resource(kind));
    const resolve = createGrafanaLinkResolver(read, root);

    await expect(resolve(link)).resolves.toBe(route);
    expect(read.mock.calls).toEqual([[{ path }]]);
  });

  it.each([
    { link: '_folder.json', root: undefined, route: '/dashboards/f/root-uid' },
    { link: '/', root: undefined, route: '/dashboards/f/root-uid' },
    { link: 'README.md', root: undefined, route: '/dashboards/f/root-uid?docTab=README.md' },
    { link: 'dev/resources/_folder.json', root: 'dev/resources', route: '/dashboards/f/root-uid' },
  ])('resolves $link through the root folder lookup, not the file listing', async ({ link, root, route }) => {
    const read = jest.fn();
    const readRootFolder = jest.fn().mockResolvedValue('root-uid');
    const resolve = createGrafanaLinkResolver(read, root, readRootFolder);

    await expect(resolve(link)).resolves.toBe(route);
    expect(readRootFolder.mock.calls).toEqual([[]]);
    expect(read).not.toHaveBeenCalled();
  });

  it('leaves a root Markdown link on the host when there is no root folder', async () => {
    const read = jest.fn();
    const readRootFolder = jest.fn().mockResolvedValue(undefined);
    const resolve = createGrafanaLinkResolver(read, undefined, readRootFolder);

    await expect(resolve('README.md')).resolves.toBeUndefined();
    expect(readRootFolder.mock.calls).toEqual([[]]);
    expect(read).not.toHaveBeenCalled();
  });

  it('does not look up links outside the configured root, including similarly prefixed paths', async () => {
    const read = jest.fn().mockResolvedValue(resource('dashboards'));
    const resolve = createGrafanaLinkResolver(read, 'grafana');

    await expect(resolve('grafana/team-a/cpu.json')).resolves.toBe('/d/synced-uid');
    await expect(resolve('team-a/cpu.json')).resolves.toBeUndefined();
    await expect(resolve('grafana-other/cpu.json')).resolves.toBeUndefined();
    expect(read.mock.calls).toEqual([[{ path: 'team-a/cpu.json' }]]);
  });

  it.each([
    {
      description: 'no existing object',
      value: { ...resource('dashboards'), resource: { ...resource('dashboards').resource, existing: undefined } },
    },
    { description: 'no existing name', value: resource('dashboards', '') },
    { description: 'a kind without a per-item route', value: resource('librarypanels') },
    {
      description: 'a resource from an unknown API group',
      value: {
        ...resource('dashboards'),
        resource: { ...resource('dashboards').resource, type: { resource: 'dashboards', group: 'other.example.com' } },
      },
    },
    { description: 'validation errors', value: { ...resource('dashboards'), errors: ['invalid resource'] } },
  ])('leaves the host link when the response has $description', async ({ value }) => {
    const read = jest.fn().mockResolvedValue(value);
    const resolve = createGrafanaLinkResolver(read, undefined);

    await expect(resolve('team-a/cpu.json')).resolves.toBeUndefined();
    expect(read.mock.calls).toEqual([[{ path: 'team-a/cpu.json' }]]);
  });

  it('does not route Markdown to a non-folder response', async () => {
    const read = jest.fn().mockResolvedValue(resource('dashboards'));
    const resolve = createGrafanaLinkResolver(read, undefined);

    await expect(resolve('team-a/NOTES.md')).resolves.toBeUndefined();
    expect(read.mock.calls).toEqual([[{ path: 'team-a/' }]]);
  });
});

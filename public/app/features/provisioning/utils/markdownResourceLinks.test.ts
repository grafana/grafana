import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { type ResourceListItem, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { rewriteRelativeMarkdownLinks } from './markdownLinks';
import { resolveMarkdownResourceLinks } from './markdownResourceLinks';

const repository: RepositoryView = {
  name: 'repo',
  type: 'github',
  url: 'https://github.com/owner/repo',
  branch: 'main',
  title: 'Repo',
  target: 'folder',
  workflows: [],
};

function item(
  path: string,
  name: string,
  resource = 'dashboards',
  group = resource === 'folders' ? 'folder.grafana.app' : 'dashboard.grafana.app'
): ResourceListItem {
  return { path, name, resource, group, hash: '' };
}

function rewrite(links: string[], root = '', type: RepositoryView['type'] = 'github') {
  return rewriteRelativeMarkdownLinks(links.map((href, i) => `<a href="${href}">link ${i}</a>`).join(''), {
    repository: { ...repository, type, path: root },
    baseDirInRepo: [root, 'team'].filter(Boolean).join('/'),
  });
}

function anchors(html: string) {
  return [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a')];
}

describe('resolveMarkdownResourceLinks', () => {
  beforeEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
  });

  it('deduplicates exact paths across files, folders, metadata, and Markdown docs', async () => {
    const lookup = jest.fn().mockResolvedValue({
      items: [item('team/cpu.json', 'cpu'), item('team/', 'folder', 'folders'), item('/', 'repo', 'folders')],
    });
    const result = await resolveMarkdownResourceLinks(
      rewrite([
        './cpu.json',
        'cpu.json?var-env=prod#panel-1',
        './',
        './_folder.json',
        './CONTRIBUTING.md#rules',
        '../README.md',
        '/',
      ]),
      lookup
    );

    expect(lookup.mock.calls).toEqual([[['team/cpu.json', 'team/', '/']]]);
    expect(anchors(result).map((a) => a.getAttribute('href'))).toEqual([
      '/d/cpu',
      '/d/cpu?var-env=prod#panel-1',
      '/dashboards/f/folder',
      '/dashboards/f/folder',
      '/dashboards/f/folder?docTab=CONTRIBUTING.md#rules',
      '/dashboards/f/repo?docTab=README.md',
      '/dashboards/f/repo',
    ]);
    for (const anchor of anchors(result)) {
      expect(anchor.getAttribute('target')).toBeNull();
      expect(anchor.getAttribute('rel')).toBeNull();
    }
  });

  it('strips the configured root and leaves paths outside it on the host', async () => {
    const lookup = jest.fn().mockResolvedValue({ items: [item('team/cpu.yaml', 'cpu'), item('/', 'root', 'folders')] });
    const result = await resolveMarkdownResourceLinks(
      rewrite(['./cpu.yaml', '../', '../../outside.json', '/ops/resources-other/cpu.json'], 'ops/resources'),
      lookup,
      '/ops/resources/'
    );

    expect(lookup.mock.calls).toEqual([[['team/cpu.yaml', '/']]]);
    expect(anchors(result).map((a) => a.getAttribute('href'))).toEqual([
      '/d/cpu',
      '/dashboards/f/root',
      'https://github.com/owner/repo/blob/main/ops/outside.json',
      'https://github.com/owner/repo/blob/main/ops/resources-other/cpu.json',
    ]);
  });

  it('batches more than 50 unique paths and resolves every batch', async () => {
    const paths = Array.from({ length: 103 }, (_, i) => `team/${i}.json`);
    const lookup = jest.fn(async (paths: string[]) => ({ items: paths.map((path) => item(path, path.split('/')[1])) }));
    const result = await resolveMarkdownResourceLinks(rewrite(paths.map((path) => '/' + path)), lookup);

    expect(lookup.mock.calls).toEqual([[paths.slice(0, 50)], [paths.slice(50, 100)], [paths.slice(100)]]);
    expect(anchors(result).map((a) => a.getAttribute('href'))).toEqual(paths.map((_, i) => `/d/${i}.json`));
  });

  it('keeps denied, missing, ambiguous, unsupported, and wrong-group results on the host', async () => {
    const links = [
      './allowed.json',
      './denied.json',
      './missing.json',
      './duplicate.json',
      './unsupported.json',
      './foreign.json',
    ];
    const lookup = jest.fn().mockResolvedValue({
      items: [
        item('team/allowed.json', 'allowed'),
        item('team/duplicate.json', 'a'),
        item('team/duplicate.json', 'b'),
        item('team/unsupported.json', 'panel', 'librarypanels'),
        item('team/foreign.json', 'foreign', 'dashboards', 'other.group'),
        item('not-requested.json', 'not-requested'),
      ],
    });
    const result = anchors(await resolveMarkdownResourceLinks(rewrite(links), lookup));

    expect(result.map((a) => a.getAttribute('href'))).toEqual([
      '/d/allowed',
      ...links.slice(1).map((path) => 'https://github.com/owner/repo/blob/main/team/' + path.slice(2)),
    ]);
    expect(result[1].getAttribute('target')).toBe('_blank');
  });

  it('does not send external URLs, images, anchors, or unsupported paths', async () => {
    const lookup = jest.fn();
    const original = rewrite([
      'https://example.com/cpu.json',
      '#heading',
      'image.png',
      'LICENSE',
      './.hidden/a.json',
      './bad%25name.json',
    ]);
    expect(await resolveMarkdownResourceLinks(original, lookup)).toBe(original);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves local repository links without needing a host URL', async () => {
    const lookup = jest.fn().mockResolvedValue({ items: [item('team/cpu.json', 'cpu')] });
    const result = await resolveMarkdownResourceLinks(rewrite(['./cpu.json'], '', 'local'), lookup);
    expect(anchors(result)[0].getAttribute('href')).toBe('/d/cpu');
  });

  it('honors the Grafana subpath and preserves document query and fragment', async () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    const lookup = jest.fn().mockResolvedValue({ items: [item('team/', 'folder', 'folders')] });
    const result = await resolveMarkdownResourceLinks(
      rewrite(['./Release%20Notes.md?orgId=1&docTab=old#changes']),
      lookup
    );
    expect(anchors(result)[0].getAttribute('href')).toBe(
      '/grafana/dashboards/f/folder?orgId=1&docTab=Release+Notes.md#changes'
    );
  });

  it('does not accept resolver attributes supplied by Markdown authors', async () => {
    const lookup = jest.fn();
    const html = rewriteRelativeMarkdownLinks(
      '<a href="https://example.com" data-provisioning-repo-path="secret.json" data-provisioning-repo-suffix="?secret" data-provisioning-route="/d/secret">external</a>',
      { repository, baseDirInRepo: '' }
    );
    const result = await resolveMarkdownResourceLinks(html, lookup);
    expect(lookup).not.toHaveBeenCalled();
    expect(result).toBe('<a href="https://example.com">external</a>');
  });

  it('rejects failed lookups without returning a partially resolved document', async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce({ items: [item('team/0.json', 'first')] })
      .mockRejectedValueOnce(new Error('unavailable'));
    await expect(
      resolveMarkdownResourceLinks(rewrite(Array.from({ length: 51 }, (_, i) => `./${i}.json`)), lookup)
    ).rejects.toThrow('unavailable');
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

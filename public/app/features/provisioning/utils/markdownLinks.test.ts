import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { rewriteRelativeMarkdownLinks } from './markdownLinks';

const githubRepo: RepositoryView = {
  name: 'manifests',
  target: 'folder',
  title: 'Manifests',
  type: 'github',
  url: 'https://github.com/grafana/grafana-manifests',
  branch: 'main',
  workflows: [],
};

const baseDir = 'ops/resources/RnD';

describe('rewriteRelativeMarkdownLinks', () => {
  it('rewrites parent-relative paths against the README directory', () => {
    const html = `<p><a href="../../../.github/CODEOWNERS">CODEOWNERS</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="https://github.com/grafana/grafana-manifests/blob/main/.github/CODEOWNERS"');
  });

  it('uses the tree URL for directory targets (trailing slash)', () => {
    const html = `<p><a href="../../../dev/resources/GTM/">GTM</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="https://github.com/grafana/grafana-manifests/tree/main/dev/resources/GTM"');
  });

  it('treats root-relative paths as repo-root paths', () => {
    const html = `<p><a href="/.github/CODEOWNERS">root</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="https://github.com/grafana/grafana-manifests/blob/main/.github/CODEOWNERS"');
  });

  it('resolves sibling paths against the README directory', () => {
    const html = `<p><a href="./notes.md">notes</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="https://github.com/grafana/grafana-manifests/blob/main/ops/resources/RnD/notes.md"');
  });

  it('adds target=_blank and rel=noopener when rewriting', () => {
    const html = `<p><a href="../README.md">parent README</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toMatch(/target="_blank"/);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it('leaves http(s) and other absolute schemes alone', () => {
    const html = `<p><a href="https://example.com">x</a> <a href="mailto:a@b">m</a> <a href="//cdn.example/x">y</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="mailto:a@b"');
    expect(out).toContain('href="//cdn.example/x"');
  });

  it('leaves intra-document anchors alone', () => {
    const html = `<p><a href="#section">jump</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, { repository: githubRepo, baseDirInRepo: baseDir });

    expect(out).toContain('href="#section"');
  });

  it('preserves repository.branch in the rewritten URL', () => {
    const html = `<p><a href="./CODEOWNERS">x</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, {
      repository: { ...githubRepo, branch: 'release/v9' },
      baseDirInRepo: '.github',
    });

    expect(out).toContain('href="https://github.com/grafana/grafana-manifests/blob/release/v9/.github/CODEOWNERS"');
  });

  it('strips href when the host has no link URL pattern (e.g. local)', () => {
    const html = `<p><a href="../README.md">x</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, {
      repository: { ...githubRepo, type: 'local', url: '/data/repo' },
      baseDirInRepo: 'team-a',
    });

    // The link text remains, but the broken relative href is removed.
    expect(out).not.toMatch(/href="\.\.\/README\.md"/);
    expect(out).not.toMatch(/href="\/data\/repo/);
    expect(out).toContain('>x</a>');
  });

  it('handles GitLab repositories', () => {
    const html = `<p><a href="../docs/README.md">x</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, {
      repository: {
        ...githubRepo,
        type: 'gitlab',
        url: 'https://gitlab.com/group/repo',
      },
      baseDirInRepo: 'team-a',
    });

    expect(out).toContain('href="https://gitlab.com/group/repo/-/blob/main/docs/README.md"');
  });

  it('handles Bitbucket repositories', () => {
    const html = `<p><a href="../docs/README.md">x</a></p>`;
    const out = rewriteRelativeMarkdownLinks(html, {
      repository: {
        ...githubRepo,
        type: 'bitbucket',
        url: 'https://bitbucket.org/workspace/repo',
      },
      baseDirInRepo: 'team-a',
    });

    expect(out).toContain('href="https://bitbucket.org/workspace/repo/src/main/docs/README.md"');
  });
});

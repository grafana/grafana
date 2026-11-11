import { type FolderDoc, getDocTabLabel, listFolderDocs } from './folderDocConventions';

describe('listFolderDocs', () => {
  it('lists convention docs first (in priority order), then other markdown alphabetically', () => {
    const paths = [
      'dashboards/team-a/RUNBOOK.md',
      'dashboards/team-a/SECURITY.md',
      'dashboards/team-a/README.md',
      'dashboards/team-a/some-dashboard.json',
      'dashboards/team-a/CONTRIBUTING.md',
      'dashboards/team-a/architecture.md',
    ];

    const docs = listFolderDocs(paths, 'dashboards/team-a');

    expect(docs.map((d) => d.fileName)).toEqual([
      'README.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'architecture.md',
      'RUNBOOK.md',
    ]);
    expect(docs.slice(0, 3).map((d) => d.key)).toEqual(['readme', 'contributing', 'security']);
    expect(docs[3].key).toBeUndefined();
  });

  it('only lists .md files: .markdown, extensionless README and non-markdown files are skipped', () => {
    // The provisioning files API only serves `.md`, so anything else would 404 as a tab.
    const docs = listFolderDocs(
      [
        'dashboards/team-a/notes.md',
        'dashboards/team-a/guide.markdown',
        'dashboards/team-a/README',
        'dashboards/team-a/SECURITY.markdown',
        'dashboards/team-a/dash.json',
        'dashboards/team-a/config.yaml',
      ],
      'dashboards/team-a'
    );
    expect(docs).toEqual([
      // Synthesized: the extensionless `README` doesn't count.
      { key: 'readme', path: 'dashboards/team-a/README.md', fileName: 'README.md' },
      { path: 'dashboards/team-a/notes.md', fileName: 'notes.md' },
    ]);
  });

  it('matches convention file names case-insensitively and keeps the actual file', () => {
    const docs = listFolderDocs(['dashboards/team-a/readme.md'], 'dashboards/team-a');
    expect(docs).toEqual([{ key: 'readme', path: 'dashboards/team-a/readme.md', fileName: 'readme.md' }]);
  });

  it('ignores docs in sub-folders or parent folders', () => {
    const paths = [
      'dashboards/team-a/nested/README.md', // sub-folder
      'dashboards/README.md', // parent folder
      'dashboards/team-a/README.md', // this folder
    ];

    const docs = listFolderDocs(paths, 'dashboards/team-a');

    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe('dashboards/team-a/README.md');
  });

  it('matches docs at the repository root when the source dir is empty', () => {
    const docs = listFolderDocs(['README.md', 'nested/README.md'], '');
    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe('README.md');
  });

  it('tolerates a trailing slash on the source dir', () => {
    const docs = listFolderDocs(['dashboards/team-a/README.md'], 'dashboards/team-a/');
    expect(docs).toEqual([{ key: 'readme', path: 'dashboards/team-a/README.md', fileName: 'README.md' }]);
  });

  it('prepends a synthetic README tab when the folder has other docs but no README', () => {
    const docs = listFolderDocs(['dashboards/team-a/CONTRIBUTING.md'], 'dashboards/team-a');

    expect(docs.map((d) => d.key)).toEqual(['readme', 'contributing']);
    expect(docs[0]).toEqual({ key: 'readme', path: 'dashboards/team-a/README.md', fileName: 'README.md' });
  });

  it('returns only a synthetic README when no markdown docs exist', () => {
    expect(listFolderDocs(['dashboards/team-a/dash.json'], 'dashboards/team-a')).toEqual([
      { key: 'readme', path: 'dashboards/team-a/README.md', fileName: 'README.md' },
    ]);
  });

  it('synthesizes the README at the repository root when there is no source dir', () => {
    expect(listFolderDocs([], '')).toEqual([{ key: 'readme', path: 'README.md', fileName: 'README.md' }]);
  });
});

describe('getDocTabLabel', () => {
  it('uses the GitHub tab label for every recognized convention', () => {
    const labels = (['readme', 'contributing', 'security'] as const).map((key) =>
      getDocTabLabel({ key, path: `a/${key}.md`, fileName: `${key}.md` })
    );
    expect(labels).toEqual(['README', 'Contributing', 'Security']);
  });

  it('uses the file name without extension for other markdown', () => {
    const changelog: FolderDoc = { path: 'a/CHANGELOG.md', fileName: 'CHANGELOG.md' };
    expect(getDocTabLabel(changelog)).toBe('CHANGELOG');
    expect(getDocTabLabel({ path: 'a/notes.MD', fileName: 'notes.MD' })).toBe('notes');
  });

  it('falls back to the raw file name when stripping the extension would leave it empty', () => {
    expect(getDocTabLabel({ path: 'a/.md', fileName: '.md' })).toBe('.md');
  });
});

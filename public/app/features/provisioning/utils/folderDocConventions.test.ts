import { type FolderDoc, getDocTabLabel, getFolderDocLabel, listFolderDocs } from './folderDocConventions';

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

  it('includes .markdown files and excludes non-markdown files', () => {
    const docs = listFolderDocs(
      ['dashboards/team-a/notes.markdown', 'dashboards/team-a/dash.json', 'dashboards/team-a/config.yaml'],
      'dashboards/team-a'
    );
    expect(docs.map((d) => d.fileName)).toEqual(['notes.markdown']);
  });

  it('matches convention file names case-insensitively', () => {
    const docs = listFolderDocs(['dashboards/team-a/readme.md'], 'dashboards/team-a');
    expect(docs).toHaveLength(1);
    expect(docs[0].key).toBe('readme');
    expect(docs[0].fileName).toBe('readme.md');
  });

  it('recognizes alternative file names for a convention', () => {
    // A README without the .md extension still maps to the README convention.
    const docs = listFolderDocs(['dashboards/team-a/README'], 'dashboards/team-a');
    expect(docs).toHaveLength(1);
    expect(docs[0].key).toBe('readme');
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
    expect(docs).toHaveLength(1);
  });

  it('returns nothing when no markdown docs exist', () => {
    expect(listFolderDocs(['dashboards/team-a/dash.json'], 'dashboards/team-a')).toEqual([]);
  });
});

describe('getFolderDocLabel', () => {
  it('returns the GitHub tab label for every convention', () => {
    const labels = (['readme', 'contributing', 'security'] as const).map(getFolderDocLabel);
    expect(labels).toEqual(['README', 'Contributing', 'Security']);
  });
});

describe('getDocTabLabel', () => {
  it('uses the convention label for recognized docs', () => {
    const doc: FolderDoc = { key: 'contributing', path: 'a/CONTRIBUTING.md', fileName: 'CONTRIBUTING.md' };
    expect(getDocTabLabel(doc)).toBe('Contributing');
  });

  it('uses the file name without extension for other markdown', () => {
    expect(getDocTabLabel({ path: 'a/CHANGELOG.md', fileName: 'CHANGELOG.md' })).toBe('CHANGELOG');
    expect(getDocTabLabel({ path: 'a/notes.markdown', fileName: 'notes.markdown' })).toBe('notes');
  });
});

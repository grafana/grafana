import { findFolderDocs, getFolderDocLabel } from './folderDocConventions';

describe('findFolderDocs', () => {
  it('matches recognized docs directly inside the folder, ordered like GitHub', () => {
    const paths = [
      'dashboards/team-a/SECURITY.md',
      'dashboards/team-a/README.md',
      'dashboards/team-a/some-dashboard.json',
      'dashboards/team-a/CONTRIBUTING.md',
    ];

    const docs = findFolderDocs(paths, 'dashboards/team-a');

    expect(docs.map((d) => d.convention.key)).toEqual(['readme', 'contributing', 'security']);
    expect(docs[0].path).toBe('dashboards/team-a/README.md');
  });

  it('matches convention file names case-insensitively', () => {
    const docs = findFolderDocs(['dashboards/team-a/readme.md'], 'dashboards/team-a');
    expect(docs).toHaveLength(1);
    expect(docs[0].convention.key).toBe('readme');
    expect(docs[0].fileName).toBe('readme.md');
  });

  it('recognizes alternative file names for a convention', () => {
    // A README without the .md extension still maps to the README tab.
    const docs = findFolderDocs(['dashboards/team-a/README'], 'dashboards/team-a');
    expect(docs).toHaveLength(1);
    expect(docs[0].convention.key).toBe('readme');
  });

  it('ignores docs in sub-folders or parent folders', () => {
    const paths = [
      'dashboards/team-a/nested/README.md', // sub-folder
      'dashboards/README.md', // parent folder
      'dashboards/team-a/README.md', // this folder
    ];

    const docs = findFolderDocs(paths, 'dashboards/team-a');

    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe('dashboards/team-a/README.md');
  });

  it('matches docs at the repository root when the source dir is empty', () => {
    const docs = findFolderDocs(['README.md', 'nested/README.md'], '');
    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe('README.md');
  });

  it('tolerates a trailing slash on the source dir', () => {
    const docs = findFolderDocs(['dashboards/team-a/README.md'], 'dashboards/team-a/');
    expect(docs).toHaveLength(1);
  });

  it('returns nothing when no recognized docs exist', () => {
    expect(findFolderDocs(['dashboards/team-a/dash.json'], 'dashboards/team-a')).toEqual([]);
  });
});

describe('getFolderDocLabel', () => {
  it('returns the GitHub tab label for every convention', () => {
    const labels = (['readme', 'contributing', 'security'] as const).map(getFolderDocLabel);
    expect(labels).toEqual(['README', 'Contributing', 'Security']);
  });
});

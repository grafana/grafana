import { t } from '@grafana/i18n';

/**
 * Folder documentation conventions, ordered the way GitHub surfaces them as
 * tabs above a repository's README: README, Contributing, Security. Grafana
 * recognizes the same community-health filenames inside a provisioned folder
 * and promotes each present file into a tab.
 */
export type FolderDocKey = 'readme' | 'contributing' | 'security';

export interface FolderDocConvention {
  key: FolderDocKey;
  /** Canonical file name, used when creating the file from the empty state. */
  fileName: string;
  /** File names recognized for this convention, matched case-insensitively. */
  matches: string[];
}

export const FOLDER_DOC_CONVENTIONS: FolderDocConvention[] = [
  { key: 'readme', fileName: 'README.md', matches: ['README.md', 'README.markdown', 'README'] },
  { key: 'contributing', fileName: 'CONTRIBUTING.md', matches: ['CONTRIBUTING.md'] },
  { key: 'security', fileName: 'SECURITY.md', matches: ['SECURITY.md'] },
];

/** The README convention is the default tab and drives the empty state. */
export const README_CONVENTION = FOLDER_DOC_CONVENTIONS[0];

/**
 * Translated tab label for a convention. Uses a switch of literal `t()` calls
 * so the strings are statically extractable — a dynamic `t(key)` would not be.
 */
export function getFolderDocLabel(key: FolderDocKey): string {
  switch (key) {
    case 'readme':
      return t('browse-dashboards.readme.tab-readme', 'README');
    case 'contributing':
      return t('browse-dashboards.readme.tab-contributing', 'Contributing');
    case 'security':
      return t('browse-dashboards.readme.tab-security', 'Security');
  }
}

export interface FolderDocMatch {
  convention: FolderDocConvention;
  /** Path relative to the repository's configured root. */
  path: string;
  /** Actual file name as it appears in the repository. */
  fileName: string;
}

/**
 * Finds the convention docs that live directly inside `sourceDir` (the folder's
 * source path, relative to the repository root). Only immediate children match
 * — a `README.md` in a sub-folder belongs to that sub-folder, not this one.
 *
 * Results are ordered by convention priority, not by their order in `filePaths`.
 */
export function findFolderDocs(filePaths: string[], sourceDir: string): FolderDocMatch[] {
  const dir = stripTrailingSlashes(sourceDir);
  const matches: FolderDocMatch[] = [];

  for (const convention of FOLDER_DOC_CONVENTIONS) {
    const candidates = convention.matches.map((name) => name.toLowerCase());
    for (const path of filePaths) {
      const slash = path.lastIndexOf('/');
      const fileDir = slash >= 0 ? path.slice(0, slash) : '';
      const fileName = slash >= 0 ? path.slice(slash + 1) : path;
      if (fileDir === dir && candidates.includes(fileName.toLowerCase())) {
        matches.push({ convention, path, fileName });
        break;
      }
    }
  }

  return matches;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

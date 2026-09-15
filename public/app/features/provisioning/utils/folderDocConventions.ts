import { t } from '@grafana/i18n';

/**
 * Recognized folder documentation conventions, ordered the way GitHub surfaces
 * them as tabs above a repository's README: README, Contributing, Security.
 * These always sort ahead of any other markdown files in the folder and get a
 * friendly, localized tab label instead of their raw file name.
 */
export type FolderDocKey = 'readme' | 'contributing' | 'security';

/**
 * Query param that selects a folder doc tab by its file name (e.g.
 * `?docTab=CONTRIBUTING.md`). Shared so links that resolve to a doc in another
 * folder can deep-link straight to the right tab.
 */
export const FOLDER_DOC_TAB_PARAM = 'docTab';

interface FolderDocConvention {
  key: FolderDocKey;
  /** File name matched case-insensitively; also used when creating the file from the empty state. */
  fileName: string;
}

// Only `.md` is recognized: the provisioning files API serves no other doc extension.
const FOLDER_DOC_CONVENTIONS: FolderDocConvention[] = [
  { key: 'readme', fileName: 'README.md' },
  { key: 'contributing', fileName: 'CONTRIBUTING.md' },
  { key: 'security', fileName: 'SECURITY.md' },
];

/** The README convention is the default tab and drives the empty state. */
export const README_CONVENTION = FOLDER_DOC_CONVENTIONS[0];

export interface FolderDoc {
  /** Set when the file is a recognized convention; undefined for other markdown. */
  key?: FolderDocKey;
  /** Path relative to the repository's configured root. */
  path: string;
  /** Actual file name as it appears in the repository. */
  fileName: string;
}

/**
 * Localized tab label for a recognized convention. Uses a switch of literal
 * `t()` calls so the strings are statically extractable — a dynamic `t(key)`
 * would not be.
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

/** Tab label for any doc: the convention label, or the file name sans extension. */
export function getDocTabLabel(doc: FolderDoc): string {
  return doc.key ? getFolderDocLabel(doc.key) : stripMarkdownExtension(doc.fileName);
}

/**
 * Lists the markdown docs directly inside `sourceDir` (the folder's source path,
 * relative to the repository root) as tabs. The recognized conventions come
 * first in their defined order; any other `.md` files follow, sorted
 * case-insensitively by file name. Only immediate children match — a
 * `README.md` in a sub-folder belongs to that sub-folder, not this one.
 */
export function listFolderDocs(filePaths: string[], sourceDir: string): FolderDoc[] {
  const dir = stripTrailingSlashes(sourceDir);
  const inDir = filePaths
    .map((path) => {
      const slash = path.lastIndexOf('/');
      return {
        path,
        dir: slash >= 0 ? path.slice(0, slash) : '',
        fileName: slash >= 0 ? path.slice(slash + 1) : path,
      };
    })
    .filter((file) => file.dir === dir);

  const docs: FolderDoc[] = [];
  const usedPaths = new Set<string>();

  for (const convention of FOLDER_DOC_CONVENTIONS) {
    const hit = inDir.find((file) => file.fileName.toLowerCase() === convention.fileName.toLowerCase());
    if (hit) {
      docs.push({ key: convention.key, path: hit.path, fileName: hit.fileName });
      usedPaths.add(hit.path);
    }
  }

  const others = inDir
    .filter((file) => !usedPaths.has(file.path) && isMarkdownFile(file.fileName))
    .sort((a, b) => {
      const an = a.fileName.toLowerCase();
      const bn = b.fileName.toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  for (const file of others) {
    docs.push({ path: file.path, fileName: file.fileName });
  }

  return docs;
}

/**
 * Guarantees a README tab is present (first), synthesizing one at the folder's
 * default README path when the file doesn't exist yet. This keeps the README
 * tab — and its "Add README" affordance — visible even when the folder only has
 * other docs, so the rest of the tabs stay reachable.
 */
export function ensureReadmeTab(docs: FolderDoc[], sourceDir: string): FolderDoc[] {
  if (docs.some((doc) => doc.key === README_CONVENTION.key)) {
    return docs;
  }
  const dir = stripTrailingSlashes(sourceDir);
  const path = dir ? `${dir}/${README_CONVENTION.fileName}` : README_CONVENTION.fileName;
  return [{ key: README_CONVENTION.key, path, fileName: README_CONVENTION.fileName }, ...docs];
}

/** Whether a file name is a markdown doc (`.md`). */
export function isMarkdownFile(fileName: string): boolean {
  return /\.md$/i.test(fileName);
}

function stripMarkdownExtension(fileName: string): string {
  // A file literally named `.md` would strip to nothing; keep the raw name then.
  return fileName.replace(/\.md$/i, '') || fileName;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

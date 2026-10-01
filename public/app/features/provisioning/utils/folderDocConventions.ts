import { t } from '@grafana/i18n';

import { joinPath, splitPath } from '../components/utils/path';

/**
 * Recognized folder documentation conventions, in the order GitHub surfaces them
 * as tabs above a repository's README. Key order is tab order. These always sort
 * ahead of any other markdown files in the folder and get a friendly, localized
 * tab label instead of their raw file name.
 *
 * File names are matched case-insensitively and reused when creating the file
 * from the empty state. Only `.md` is recognized: the provisioning files API
 * serves no other doc extension.
 */
const FOLDER_DOC_CONVENTIONS = {
  readme: { fileName: 'README.md', label: () => t('browse-dashboards.readme.tab-readme', 'README') },
  contributing: {
    fileName: 'CONTRIBUTING.md',
    label: () => t('browse-dashboards.readme.tab-contributing', 'Contributing'),
  },
  security: { fileName: 'SECURITY.md', label: () => t('browse-dashboards.readme.tab-security', 'Security') },
} as const;

export type FolderDocKey = keyof typeof FOLDER_DOC_CONVENTIONS;

function isFolderDocKey(key: string): key is FolderDocKey {
  return key in FOLDER_DOC_CONVENTIONS;
}

const FOLDER_DOC_KEYS = Object.keys(FOLDER_DOC_CONVENTIONS).filter(isFolderDocKey);

/** The README is the default tab and drives the empty state. */
const README = FOLDER_DOC_CONVENTIONS.readme;

/**
 * Query param that selects a folder doc tab by its file name (e.g.
 * `?docTab=CONTRIBUTING.md`). Shared so links that resolve to a doc in another
 * folder can deep-link straight to the right tab.
 */
export const FOLDER_DOC_TAB_PARAM = 'docTab';

export interface FolderDoc {
  /** Set when the file is a recognized convention; undefined for other markdown. */
  key?: FolderDocKey;
  /** Path relative to the repository's configured root. */
  path: string;
  /** Actual file name as it appears in the repository. */
  fileName: string;
}

/** Tab label for any doc: the convention label, or the file name sans extension. */
export function getDocTabLabel(doc: FolderDoc): string {
  return doc.key ? FOLDER_DOC_CONVENTIONS[doc.key].label() : stripMarkdownExtension(doc.fileName);
}

/**
 * Lists the markdown docs directly inside `sourceDir` (the folder's source path,
 * relative to the repository root) as tabs. The recognized conventions come
 * first in their defined order; any other `.md` files follow, sorted
 * case-insensitively by file name. Only immediate children match — a
 * `README.md` in a sub-folder belongs to that sub-folder, not this one.
 *
 * A README tab is always first: when the file doesn't exist yet it is
 * synthesized at the folder's default README path, so its "Add README"
 * affordance and the other tabs stay reachable together.
 */
export function listFolderDocs(filePaths: string[], sourceDir: string): FolderDoc[] {
  const dir = sourceDir.replace(/\/+$/, '');
  const inDir = filePaths
    .map((path) => ({ path, ...splitPath(path) }))
    .filter((file) => file.directory === dir)
    .map(({ path, filename }) => ({ path, fileName: filename }));

  const docs: FolderDoc[] = [];
  const usedPaths = new Set<string>();

  for (const key of FOLDER_DOC_KEYS) {
    const conventionName = FOLDER_DOC_CONVENTIONS[key].fileName.toLowerCase();
    const hit = inDir.find((file) => file.fileName.toLowerCase() === conventionName);
    if (hit) {
      docs.push({ key, path: hit.path, fileName: hit.fileName });
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

  if (!docs.some((doc) => doc.key === 'readme')) {
    docs.unshift({ key: 'readme', path: joinPath(dir, README.fileName), fileName: README.fileName });
  }

  return docs;
}

/** Whether a file name is a markdown doc (`.md`). */
export function isMarkdownFile(fileName: string): boolean {
  return /\.md$/i.test(fileName);
}

function stripMarkdownExtension(fileName: string): string {
  // A file literally named `.md` would strip to nothing; keep the raw name then.
  return fileName.replace(/\.md$/i, '') || fileName;
}

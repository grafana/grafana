import { t } from '@grafana/i18n';
import { type ManagerKind } from 'app/features/apiserver/types';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';

export const getRootFolderItem = (): DashboardsTreeItem => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: t('browse-dashboards.folder-picker.root-title', 'Dashboards'),
    uid: '',
  },
});

export interface FolderPath {
  /** Titles from the outermost visible ancestor down to the immediate parent. */
  titles: string[];
  /** True when the chain stops at a folder the user cannot see, so the path is incomplete. */
  hasUnknownAncestor: boolean;
}

/**
 * Walks the parent links of a folder index up to the root.
 * Returns undefined when the folder is not in the index.
 */
export function getFolderPath(
  folderIndex: Record<string, { name: string; parentUID?: string }>,
  uid: string
): FolderPath | undefined {
  const folder = folderIndex[uid];
  if (!folder) {
    return undefined;
  }

  const titles: string[] = [];
  const seen = new Set([uid]);
  let parentUID = folder.parentUID;

  while (parentUID) {
    const parent = folderIndex[parentUID];
    if (!parent) {
      titles.unshift(t('browse-dashboards.folder-picker.unknown-folder', '[Unknown folder]'));
      return { titles, hasUnknownAncestor: true };
    }
    if (seen.has(parentUID)) {
      break;
    }
    seen.add(parentUID);
    titles.unshift(parent.name);
    parentUID = parent.parentUID;
  }

  return { titles, hasUnknownAncestor: false };
}

export const getCustomRootFolderItem = ({
  title,
  managedBy,
  managerId,
  uid,
}: {
  title: string;
  managedBy?: ManagerKind;
  managerId?: string;
  uid: string;
}): DashboardsTreeItem => ({
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title,
    uid,
    managedBy,
    managerId,
  },
});

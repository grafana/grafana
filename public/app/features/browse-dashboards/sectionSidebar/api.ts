import { type SectionSidebarTreeNode } from 'app/core/components/AppChrome/SectionSidebar/primitives';
import { type DashboardViewItem } from 'app/features/search/types';

import { listDashboards, listFolders } from '../api/services';

// The sidebar is for quick access, so a large folder links out to the browse page for the rest
const CHILDREN_LIMIT = 50;

export interface DashboardsTreeNode extends SectionSidebarTreeNode {
  kind: 'folder' | 'dashboard';
}

export async function loadFolderChildren(folderUid?: string): Promise<DashboardsTreeNode[]> {
  const [folders, dashboards] = await Promise.all([
    listFolders(folderUid, undefined, 1, CHILDREN_LIMIT),
    listDashboards(folderUid, 1, CHILDREN_LIMIT),
  ]);

  return [...folders, ...dashboards].flatMap((item) => {
    const node = toTreeNode(item);
    return node ? [node] : [];
  });
}

const ROOT_PAGE_SIZE = 50;

/** One page of top level folders; the sidebar loads the next page as the list scrolls */
export async function loadRootFolders(page: number): Promise<{ nodes: DashboardsTreeNode[]; hasMore: boolean }> {
  const folders = await listFolders(undefined, undefined, page, ROOT_PAGE_SIZE);
  return {
    nodes: folders.flatMap((item) => toTreeNode(item) ?? []),
    hasMore: folders.length === ROOT_PAGE_SIZE,
  };
}

export function toTreeNode(item: DashboardViewItem): DashboardsTreeNode | undefined {
  if (item.kind === 'folder') {
    return { id: item.uid, kind: 'folder', title: item.title, url: item.url, icon: 'folder', hasChildren: true };
  }
  if (item.kind === 'dashboard') {
    return { id: item.uid, kind: 'dashboard', title: item.title, url: item.url, icon: 'apps' };
  }
  return undefined;
}

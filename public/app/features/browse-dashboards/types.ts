import { CellProps, Column, HeaderProps } from 'react-table';

import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

/**
 * Object of what is selected in the tree. It is record where keys are categories from DashboardViewItemKind and
 * each category is a record where the key is the UID of the object and value is whether it is selected or not.
 */
export type DashboardTreeSelection = Record<DashboardViewItemKind, Record<string, boolean | undefined>> & {
  $all: boolean;
};

/**
 * Stores children at a particular location in the tree, and information
 * required for pagination.
 */
export type DashboardViewItemCollection = {
  items: DashboardViewItem[];
  lastFetchedKind: 'folder' | 'dashboard';
  lastFetchedPage: number;
  lastKindHasMoreItems: boolean;
  isFullyLoaded: boolean;
};

export interface BrowseDashboardsState {
  rootItems: DashboardViewItemCollection | undefined;
  childrenByParentUID: Record<string, DashboardViewItemCollection | undefined>;
  selectedItems: DashboardTreeSelection;

  // Only folders can ever be open or closed, so no need to seperate this by kind
  openFolders: Record<string, boolean>;
}

export interface UIDashboardViewItem {
  kind: 'ui';
  uiKind: 'empty-folder' | 'pagination-placeholder' | 'divider';
  uid: string;
}

export type DashboardViewItemWithUIItems = DashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItemWithUIItems = DashboardViewItemWithUIItems> {
  item: T;
  level: number;
  isOpen: boolean;
  parentUID?: string;
}

interface RendererUserProps {
  // Note: userProps for cell renderers (e.g. second argument in `cell.render('Cell', foo)` )
  // aren't typed, so we must be careful when accessing this
  isSelected?: (kind: DashboardViewItem | '$all') => SelectionState;
  onAllSelectionChange?: (newState: boolean) => void;
  onItemSelectionChange?: (item: DashboardViewItem, newState: boolean) => void;
  treeID?: string;
  permissions?: BrowseDashboardsPermissions;
}

export type DashboardsTreeColumn = Column<DashboardsTreeItem>;
export type DashboardsTreeCellProps = CellProps<DashboardsTreeItem, unknown> & RendererUserProps;
export type DashboardTreeHeaderProps = HeaderProps<DashboardsTreeItem> & RendererUserProps;

export enum SelectionState {
  Unselected,
  Selected,
  Mixed,
}

export interface BrowseDashboardsPermissions {
  canEditFolders: boolean;
  canEditDashboards: boolean;
  canDeleteFolders?: boolean;
  canDeleteDashboards?: boolean;
  isReadOnlyRepo?: boolean;
}

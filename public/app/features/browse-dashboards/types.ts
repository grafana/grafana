import { type CellProps, type Column, type HeaderProps } from 'react-table';

import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';

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
  // Keyed by parent folder UID. UIDs are unique per kind only (a dashboard may share a UID with a folder),
  // so only ever index this and openFolders with a folder's UID.
  childrenByParentUID: Record<string, DashboardViewItemCollection | undefined>;
  selectedItems: DashboardTreeSelection;

  // Only folders can ever be open or closed, so no need to seperate this by kind
  openFolders: Record<string, boolean>;

  // `finished` of the newest pull of each repository (by name) the loaded collections reflect.
  // Lives with the cache it stamps: both outlive the browse page, so a pull that lands while the
  // user is elsewhere is still noticed when they come back.
  repositorySyncedAt?: Record<string, number>;

  // Per collection, keyed by parent folder UID (root under GENERAL_FOLDER_UID): bumped whenever the
  // collection is dropped, marked for refresh or replaced. A load that started before the bump
  // belongs to an old listing and must not be appended or applied once it completes.
  collectionGenerations?: Record<string, number>;
}

export interface UIDashboardViewItem {
  kind: 'ui';
  uiKind: 'empty-folder' | 'pagination-placeholder' | 'divider' | 'readme';
  uid: string;
}

export type DashboardViewItemWithUIItems = DashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItemWithUIItems = DashboardViewItemWithUIItems> {
  item: T;
  level: number;
  isOpen: boolean;
  parentUID?: string;
  disabled?: boolean;
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

interface NotificationEventData {
  alertType: string;
  message: string;
}

interface NotificationActionData {
  title: string;
  buttonLabel: string;
  targetUrl: string;
}

export type RestoreNotificationData =
  | { kind: 'action'; data: NotificationActionData }
  | { kind: 'event'; data: NotificationEventData };

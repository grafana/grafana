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

  // UIDs (folders or dashboards) currently undergoing an async, finalizer-driven cascade delete
  // (i.e. a delete was requested and `metadata.deletionTimestamp` is set, but the item isn't
  // actually gone yet). Populated by the delete call sites (folder delete facades in
  // app/api/clients/folder/v1beta1/hooks.ts, and the dashboard delete mutation in
  // api/browseDashboardsAPI.ts); cleared once the item is confirmed gone. PoC for
  // kubernetesFolderCascadeDeleteAsync.
  cascadeDeletingUIDs: Record<string, boolean>;

  // Errors from an ancestor's cascade delete that specifically named this UID (see
  // usePropagateCascadeDeleteToChildren) -- a child folder or dashboard has no status of its own
  // to poll for this (the error lives on whichever ancestor's reconcile pass tried and failed to
  // delete it), so this is how its row finds out it's the one actually stuck, rather than showing
  // a plain "Deleting" spinner forever. Cleared alongside cascadeDeletingUIDs.
  cascadeDeleteErrors: Record<string, string[]>;
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

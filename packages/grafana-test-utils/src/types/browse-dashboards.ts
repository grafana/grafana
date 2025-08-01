// FIXME: This file is a duplication of types within the core code
// Where should these live long term?
// @grafana/schema?
// New package @grafana/core? @grafana/types?

enum ManagerKind {
  Repo = 'repo',
  Terraform = 'terraform',
  Kubectl = 'kubectl',
  Plugin = 'plugin',
}

type DashboardViewItemKind = 'folder' | 'dashboard' | 'panel';

type DashboardViewItemWithUIItems = DashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItemWithUIItems = DashboardViewItemWithUIItems> {
  item: T;
  level: number;
  isOpen: boolean;
  parentUID?: string;
}

export interface UIDashboardViewItem {
  kind: 'ui';
  uiKind: 'empty-folder' | 'pagination-placeholder' | 'divider';
  uid: string;
  // Optional title to make mock data easier to work with
  title?: string;
}

/**
 * Type used in the folder view components
 */
export interface DashboardViewItem {
  kind: DashboardViewItemKind;
  uid: string;
  title: string;
  url?: string;
  tags?: string[];

  icon?: string;

  parentUID?: string;
  /** @deprecated Not used in new Browse UI */
  parentTitle?: string;
  /** @deprecated Not used in new Browse UI */
  parentKind?: string;

  // Used only for psuedo-folders, such as Starred or Recent
  /** @deprecated Not used in new Browse UI */
  itemsUIDs?: string[];

  // For enterprise sort options
  sortMeta?: number | string; // value sorted by
  sortMetaName?: string; // name of the value being sorted e.g. 'Views'
  managedBy?: ManagerKind;
}

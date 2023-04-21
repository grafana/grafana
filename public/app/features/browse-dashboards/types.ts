import { DashboardViewItem as DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

export interface BrowseDashboardsState {
  rootItems: DashboardViewItem[];
  childrenByParentUID: Record<string, DashboardViewItem[] | undefined>;
  selectedItems: DashboardTreeSelection;

  // Only folders can ever be open or closed, so no need to seperate this by kind
  openFolders: Record<string, boolean>;
}

export interface UIDashboardViewItem {
  kind: 'ui-empty-folder';
  uid: string;
}

type DashboardViewItemWithUIItems = DashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItemWithUIItems = DashboardViewItemWithUIItems> {
  item: T;
  level: number;
  isOpen: boolean;
}

export type DashboardTreeSelection = Record<DashboardViewItemKind, Record<string, boolean | undefined>>;

export const INDENT_AMOUNT_CSS_VAR = '--dashboards-tree-indentation';

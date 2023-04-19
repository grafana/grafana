import { DashboardViewItem as OrigDashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

export interface UIDashboardViewItem {
  kind: 'ui-empty-folder';
  uid: string;
}

type DashboardViewItem = OrigDashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItem = DashboardViewItem> {
  item: T;
  level: number;
  isOpen: boolean;
}

export type DashboardTreeSelection = Record<DashboardViewItemKind, Record<string, boolean | undefined>>;

export const INDENT_AMOUNT_CSS_VAR = '--dashboards-tree-indentation';

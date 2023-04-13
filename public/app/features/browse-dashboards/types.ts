import { DashboardViewItem as OrigDashboardViewItem } from 'app/features/search/types';

interface UIDashboardViewItem {
  kind: 'ui-empty-folder';
}

type DashboardViewItem = OrigDashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem<T extends DashboardViewItem = DashboardViewItem> {
  item: T;
  level: number;
  isOpen: boolean;
}

export const INDENT_AMOUNT_CSS_VAR = '--dashboards-tree-indentation';

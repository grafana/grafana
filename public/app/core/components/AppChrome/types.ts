import type { NavModelItem } from '@grafana/data/types';

export interface ToolbarUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

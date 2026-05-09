import { type NavModelItem } from '@grafana/data';

export interface ToolbarUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

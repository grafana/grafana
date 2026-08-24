import { type CascaderOption } from './types';

export const TREE_ROOT_ID = '__grafana_cascader_root__';

export interface TreeSelectNode {
  id: string;
  value: string;
  label: string;
  menuLabel: string;
  displayLabel: string;
  children: string[];
  folder: boolean;
  disabled: boolean;
  path: CascaderOption[];
  customDescription?: string;
}

export interface TreeSelectData {
  nodes: Map<string, TreeSelectNode>;
  expandedItems: string[];
}

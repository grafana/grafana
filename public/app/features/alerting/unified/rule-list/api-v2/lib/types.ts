import { type Rule, type RuleGroup } from 'app/types/unified-alerting';
import { type PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export type StateChip = 'firing' | 'pending' | 'recovering' | 'normal';

export type StateChipCounts = Record<StateChip, number>;

export interface TreeFolder {
  key: string;
  title: string;
  groups: RuleGroup[];
}

export interface TreeDataSource {
  uid: string;
  name: string;
  isGrafana: boolean;
  error?: string;
  folders: TreeFolder[];
}

export interface TreeModel {
  dataSources: TreeDataSource[];
}

export interface ChainInfo {
  isChain: boolean;
  dependencies: Map<string, string[]>;
}

export interface SelectedFolder {
  dataSourceUid: string;
  folderKey: string;
}

export type SelectedView = { kind: 'folder'; folder: SelectedFolder } | { kind: 'deleted' } | { kind: 'empty' };

export function isAlertRule(rule: Rule): boolean {
  return rule.type === 'alerting';
}

export function isRecordingRule(rule: Rule): boolean {
  return rule.type === 'recording';
}

export function getStateBucket(state: PromAlertingRuleState | undefined): StateChip | undefined {
  switch (state) {
    case 'firing':
      return 'firing';
    case 'pending':
      return 'pending';
    case 'recovering':
      return 'recovering';
    case 'inactive':
      return 'normal';
    default:
      return undefined;
  }
}

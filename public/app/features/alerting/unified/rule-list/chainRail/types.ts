export type ChainMode = 'Sequential' | 'Parallel' | 'Conditional';

export interface Chain {
  id: string;
  name: string;
  folderUid: string;
  groupName: string;
  mode: ChainMode;
  interval: string;
  ruleUids: string[];
}

export interface ChainMembership {
  id: string;
  position: number;
}

export interface ListRuleGroupChainsResponse {
  chains: Chain[];
}

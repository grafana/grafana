import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { type Chain } from './types';

export type ChainsByKey = Map<string, Chain>;

const keyOf = (folderUid: string, groupName: string) => `${folderUid}::${groupName}`;

export function buildChainsByKey(chains: Chain[]): ChainsByKey {
  const map = new Map<string, Chain>();
  for (const chain of chains) {
    map.set(keyOf(chain.folderUid, chain.groupName), chain);
  }
  return map;
}

export function getChainForGroup(chainsByKey: ChainsByKey, group: GrafanaPromRuleGroupDTO): Chain | undefined {
  return chainsByKey.get(keyOf(group.folderUid, group.name));
}

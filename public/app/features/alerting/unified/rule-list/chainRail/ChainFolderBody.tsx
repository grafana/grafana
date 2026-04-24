import { useMemo } from 'react';

import { Stack } from '@grafana/ui';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { useListRuleGroupChainsQuery } from '../../api/ruleGroupChainsApi';

import { ChainRuleCluster } from './ChainRuleCluster';
import { FlatGroupRules } from './FlatGroupRules';
import { getDevMockRulesFor } from './devMockRules';

interface ChainFolderBodyProps {
  folderUid: string;
  folderName: string;
  groups: GrafanaPromRuleGroupDTO[];
}

export function ChainFolderBody({ folderUid, folderName, groups }: ChainFolderBodyProps) {
  const { data } = useListRuleGroupChainsQuery({ folderUid });
  const chains = useMemo(() => data?.chains ?? [], [data]);

  const claimedGroupNames = useMemo(() => {
    const names = new Set<string>();
    for (const chain of chains) {
      names.add(chain.groupName);
    }
    return names;
  }, [chains]);

  return (
    <Stack direction="column" gap={0}>
      {chains.map((chain) => (
        <ChainRuleCluster
          key={chain.id}
          chain={chain}
          folderUid={folderUid}
          namespaceName={folderName}
          mockRules={getDevMockRulesFor(chain)}
        />
      ))}
      {groups
        .filter((group) => !claimedGroupNames.has(group.name))
        .map((group) => (
          <FlatGroupRules key={`grafana-ns-${folderUid}-${group.name}`} group={group} namespaceName={folderName} />
        ))}
    </Stack>
  );
}

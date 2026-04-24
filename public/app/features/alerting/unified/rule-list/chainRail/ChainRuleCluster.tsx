import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert, Stack, useStyles2 } from '@grafana/ui';
import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { trackChainHeaderActionClick } from '../../Analytics';
import { prometheusApi } from '../../api/prometheusApi';
import { RULE_LIST_POLL_INTERVAL_MS } from '../../utils/constants';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { AlertRuleListItemSkeleton } from '../components/AlertRuleListItemLoader';

import { ChainGroup } from './ChainGroup';
import { ChainHeader } from './ChainHeader';
import { getChainRailStyles } from './styles';
import { type Chain } from './types';

const { useGetGrafanaGroupsQuery } = prometheusApi;

interface ChainRuleClusterProps {
  chain: Chain;
  folderUid: string;
  namespaceName: string;
  onEdit?: (chain: Chain) => void;
  onMore?: (chain: Chain) => void;
  // Dev-only: when present, the cluster renders these instead of hitting the
  // Prometheus rules endpoint. Used to demo the layout before the real chain
  // API ships. See devMockRules.ts.
  mockRules?: GrafanaPromRuleDTO[];
}

export function ChainRuleCluster({
  chain,
  folderUid,
  namespaceName,
  onEdit,
  onMore,
  mockRules,
}: ChainRuleClusterProps) {
  const styles = useStyles2(getChainRailStyles);
  const skip = Boolean(mockRules);
  const { data: promResponse, isLoading } = useGetGrafanaGroupsQuery(
    {
      folderUid,
      groupName: chain.groupName,
      limitAlerts: 0,
    },
    { pollingInterval: RULE_LIST_POLL_INTERVAL_MS, skip }
  );

  const rules = useMemo(() => mockRules ?? promResponse?.data.groups.at(0)?.rules ?? [], [mockRules, promResponse]);

  const groupIdentifier: GrafanaRuleGroupIdentifier = useMemo(
    () => ({
      groupName: chain.groupName,
      namespace: { uid: folderUid },
      groupOrigin: 'grafana',
    }),
    [chain.groupName, folderUid]
  );

  const skeletonCount = chain.ruleUids.length > 0 ? chain.ruleUids.length : 3;

  const handleEdit = () => {
    trackChainHeaderActionClick({ chainId: chain.id, action: 'edit' });
    onEdit?.(chain);
  };
  const handleMore = () => {
    trackChainHeaderActionClick({ chainId: chain.id, action: 'more' });
    onMore?.(chain);
  };

  return (
    <ChainGroup data-testid={`chain-group-${chain.id}`}>
      <ChainHeader
        chain={chain}
        ruleCount={rules.length || chain.ruleUids.length}
        onEdit={handleEdit}
        onMore={handleMore}
      />
      <Stack direction="column" gap={0}>
        {isLoading && Array.from({ length: skeletonCount }).map((_, i) => <AlertRuleListItemSkeleton key={i} />)}
        {!isLoading && rules.length === 0 && (
          <Alert severity="info" title={t('alerting.chain-rail.no-rules', 'No rules found in this chain')} />
        )}
        {!isLoading &&
          rules.map((rule) => (
            <GrafanaRuleListItem
              key={rule.uid}
              rule={rule}
              groupIdentifier={groupIdentifier}
              namespaceName={namespaceName}
              showLocation={false}
              inChain
              className={styles.chainRule}
            />
          ))}
      </Stack>
    </ChainGroup>
  );
}

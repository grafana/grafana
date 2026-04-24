import { Icon, Stack } from '@grafana/ui';

import { DEV_DEMO_CHAIN_FOLDER_UID, DEV_DEMO_CHAIN_GROUP_NAME, DEV_DEMO_CHAIN_ID } from '../../api/ruleGroupChainsApi';
import { ListSection } from '../components/ListSection';

import { ChainRuleCluster } from './ChainRuleCluster';
import { getDevMockRulesFor } from './devMockRules';
import { type Chain } from './types';

// Dev-only: renders a synthetic "ChainDemoFolder" at the top of the
// Grafana-managed section so the chain rail is visible without any setup in
// the user's local Grafana. Gated by NODE_ENV, so the whole module is
// tree-shaken out of production bundles.
const DEMO_FOLDER_NAME = 'ChainDemoFolder';

const DEMO_CHAIN: Chain = {
  id: DEV_DEMO_CHAIN_ID,
  name: 'Chain rail demo',
  folderUid: DEV_DEMO_CHAIN_FOLDER_UID,
  groupName: DEV_DEMO_CHAIN_GROUP_NAME,
  mode: 'Sequential',
  interval: '1m',
  ruleUids: [],
};

export function DemoFolderSection() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  const mockRules = getDevMockRulesFor(DEMO_CHAIN);
  return (
    <ListSection
      title={
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="folder" />
          <span>{DEMO_FOLDER_NAME}</span>
        </Stack>
      }
    >
      <ChainRuleCluster
        chain={DEMO_CHAIN}
        folderUid={DEV_DEMO_CHAIN_FOLDER_UID}
        namespaceName={DEMO_FOLDER_NAME}
        mockRules={mockRules}
      />
    </ListSection>
  );
}

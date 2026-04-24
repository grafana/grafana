import { useState } from 'react';

import { Box, Stack } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';
import { AlertsActivityBanner } from '../AlertsActivityBanner';
import { RuleListActions } from '../RuleList.v2';
import { RuleListPageTitle } from '../RuleListPageTitle';
import RulesFilter from '../filter/RulesFilter.v2';
import { RulesFilterSidebar } from '../filter/RulesFilterSidebar';
import { useApplyDefaultSearch } from '../filter/useApplyDefaultSearch';

import { ChainDrawer } from './ChainDrawer';
import { ChainFilterField } from './ChainFilterField';
import { FlatRuleListView } from './FlatRuleListView';

export const CHAIN_URL_PARAM = 'chain';

interface OpenChain {
  chainId: string;
  position: number;
}

function RuleListV3() {
  const { filterState } = useRulesFilter();
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const chainFilter = queryParams.get(CHAIN_URL_PARAM) ?? undefined;
  const [openChain, setOpenChain] = useState<OpenChain | null>(null);

  return (
    <Stack direction="column">
      <AlertsActivityBanner />
      <Stack direction="column" gap={2}>
        <RulesFilter viewMode="grouped" onViewModeChange={() => {}} />
        <Stack direction="row" grow={1} minHeight={0}>
          <Stack direction="column" gap={1}>
            <RulesFilterSidebar />
            <ChainFilterField
              value={chainFilter}
              onChange={(next) => updateQueryParams({ [CHAIN_URL_PARAM]: next ?? undefined })}
            />
          </Stack>
          <Box flex={1} minWidth={0} paddingLeft={2}>
            <FlatRuleListView
              groupFilter={filterState.groupName}
              namespaceFilter={filterState.namespace}
              chainFilter={chainFilter}
              activeChainId={openChain?.chainId}
              onChainPillClick={(chainId, position) => setOpenChain({ chainId, position })}
            />
          </Box>
        </Stack>
      </Stack>
      {openChain && (
        <ChainDrawer
          chainId={openChain.chainId}
          currentPosition={openChain.position}
          onClose={() => setOpenChain(null)}
        />
      )}
    </Stack>
  );
}

export default function RuleListV3Page() {
  const { isApplying } = useApplyDefaultSearch();
  const { navId, pageNav } = useAlertRulesNav();

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      renderTitle={(title) => <RuleListPageTitle title={title} />}
      isLoading={isApplying}
      actions={<RuleListActions />}
    >
      {!isApplying && <RuleListV3 />}
    </AlertingPageWrapper>
  );
}

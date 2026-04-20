import { Trans } from '@grafana/i18n';
import { Box, Stack, Text } from '@grafana/ui';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { useListViewMode } from '../../components/rules/Filter/RulesViewModeSelector';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { FilterView } from '../FilterView';
import { GroupedView } from '../GroupedView';
import RulesFilter from '../filter/RulesFilter.v2';
import { RulesFilterSidebar } from '../filter/RulesFilterSidebar';

export function AlertRulesTab() {
  const { filterState } = useRulesFilter();
  const { viewMode, handleViewChange } = useListViewMode();

  const alertFilterState = { ...filterState, ruleType: PromRuleType.Alerting };

  return (
    <Stack direction="column" gap={2}>
      <Text variant="body" color="secondary">
        <Trans i18nKey="alerting.rule-list.tabs.alert-rules.description">
          Alert rules define when a notification for a particular condition should be sent out.
        </Trans>
      </Text>
      <RulesFilter viewMode={viewMode} onViewModeChange={handleViewChange} />
      <Stack direction="row" grow={1} minHeight={0}>
        <RulesFilterSidebar hiddenFilters={['ruleType']} />
        <Box flex={1} minWidth={0} paddingLeft={2}>
          {viewMode === 'list' ? (
            <FilterView filterState={alertFilterState} />
          ) : (
            <GroupedView groupFilter={alertFilterState.groupName} namespaceFilter={alertFilterState.namespace} />
          )}
        </Box>
      </Stack>
    </Stack>
  );
}

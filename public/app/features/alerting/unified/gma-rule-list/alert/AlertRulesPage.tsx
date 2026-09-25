import { Trans, t } from '@grafana/i18n';
import { Box, LinkButton, RadioButtonGroup, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertRulesFilterSidebar } from '../search/AlertRulesFilterSidebar';
import { RuleSearchInput } from '../search/RuleSearchInput';
import { getCriteriaIssues } from '../search/criteriaIssues';
import { parse } from '../search/parser';
import { serialize } from '../search/serializer';
import { alertTokens } from '../search/tokenDefinitions';
import { type Criteria, createEmptyCriteria } from '../search/types';
import { type RuleListMode, useRuleListSearchState } from '../search/useRuleListSearchState';
import { RulesPageShell } from '../shared/RulesPageShell';
import { useRuleListRefreshVersion } from '../shared/refreshRuleLists';

import { FoldersView } from './FoldersView';
import { ListView } from './ListView';

function AlertRulesBody({
  canSearch,
  mode,
  criteria,
  resetKey,
}: {
  canSearch: boolean;
  mode: RuleListMode;
  criteria: Criteria;
  resetKey: unknown;
}) {
  if (!canSearch) {
    return (
      <div role="alert">
        {t('alerting.gma-rule-list.alert-rules.invalid-filter', 'Fix the invalid filter to see results')}
      </div>
    );
  }
  if (mode === 'folders') {
    return <FoldersView resetKey={resetKey} />;
  }
  return <ListView criteria={criteria} resetKey={resetKey} />;
}

function AlertRulesPage() {
  const canCreate = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);
  const { criteria, mode, setCriteria, setMode, reset } = useRuleListSearchState('alert');
  // getCriteriaIssues is cheap and pure; recomputed here rather than trusting a slot in the
  // hook's own return so this page never has to know its internal caching.
  const issues = getCriteriaIssues(criteria, 'alert');
  const refreshVersion = useRuleListRefreshVersion('alert');

  const query = serialize(criteria);
  const hasActiveFilters = query !== serialize(createEmptyCriteria());

  const onApplyQuery = (raw: string) => {
    setCriteria(parse(raw, alertTokens).criteria);
  };

  const onClear = () => {
    reset();
  };

  // The search/filter UI only ever produces criteria; it never fetches. Skip the request and
  // show the invalid-filter state when getCriteriaIssues() reports an unresolved token or a
  // panel ID with no dashboard, rather than sending a narrower/wider request than intended.
  const canSearch = issues.length === 0;
  const resetKey = JSON.stringify([criteria, refreshVersion]);

  return (
    <RulesPageShell
      navId="alert-rules"
      pageLabel={t('alerting.gma-rule-list.alert-rules.title', 'Alert rules')}
      activeTab="active"
      activeHref="/alerting/rules/alert"
      deletedHref="/alerting/rules/alert/deleted"
      primaryAction={
        canCreate ? (
          <LinkButton href="/alerting/new/alerting" icon="plus" variant="primary">
            <Trans i18nKey="alerting.gma-rule-list.alert-rules.new-alert-rule">New alert rule</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} alignItems="center">
          <RuleSearchInput query={query} onApply={onApplyQuery} tokens={alertTokens} issues={issues} />
          <RadioButtonGroup
            value={mode}
            onChange={setMode}
            options={[
              { label: t('alerting.gma-rule-list.alert-rules.view-folders', 'Folders'), value: 'folders' },
              { label: t('alerting.gma-rule-list.alert-rules.view-list', 'List'), value: 'list' },
            ]}
          />
        </Stack>
        <Stack direction="row" gap={2}>
          <AlertRulesFilterSidebar
            criteria={criteria}
            onChange={setCriteria}
            onClear={onClear}
            hasActiveFilters={hasActiveFilters}
            issues={issues}
          />
          <Box flex={1} minWidth={0}>
            <AlertRulesBody canSearch={canSearch} mode={mode} criteria={criteria} resetKey={resetKey} />
          </Box>
        </Stack>
      </Stack>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(AlertRulesPage);

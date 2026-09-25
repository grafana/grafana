import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { Box, RadioButtonGroup, Stack } from '@grafana/ui';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertRulesHeaderActions } from '../actions/AlertRulesHeaderActions';
import { AlertRulesFilterSidebar } from '../search/AlertRulesFilterSidebar';
import { RuleSearchInput } from '../search/RuleSearchInput';
import { getCriteriaIssues } from '../search/criteriaIssues';
import { parse } from '../search/parser';
import { useAlertRulesSavedSearches } from '../search/savedSearches';
import { applySavedSearch, copyLegacySavedSearchesOnce } from '../search/savedSearchesMigration';
import { serialize } from '../search/serializer';
import { alertTokens } from '../search/tokenDefinitions';
import { type Criteria, createEmptyCriteria } from '../search/types';
import { type RuleListMode, useRuleListSearchState } from '../search/useRuleListSearchState';
import { RulesPageShell } from '../shared/RulesPageShell';
import { legacyRuleListNameResolvers } from '../shared/nameResolvers';
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
    return <FoldersView folderUids={criteria.namespaces} resetKey={resetKey} />;
  }
  return <ListView criteria={criteria} resetKey={resetKey} />;
}

function AlertRulesPage() {
  const { criteria, mode, setCriteria, setMode, reset } = useRuleListSearchState('alert');
  // getCriteriaIssues is cheap and pure; recomputed here rather than trusting a slot in the
  // hook's own return so this page never has to know its internal caching.
  const issues = getCriteriaIssues(criteria, 'alert');
  const refreshVersion = useRuleListRefreshVersion('alert');
  const savedSearches = useAlertRulesSavedSearches();

  // Copies the legacy combined collection into this page's own collection once, idempotently.
  // Runs once on mount; the migration itself is a no-op on every later mount (isKindMigrated
  // guards it), so it's safe to fire without gating this hook's own storage read on it.
  useEffect(() => {
    void copyLegacySavedSearchesOnce(legacyRuleListNameResolvers);
  }, []);

  const query = serialize(criteria);
  const hasActiveFilters = query !== serialize(createEmptyCriteria());

  const onApplyQuery = (raw: string) => {
    setCriteria(parse(raw, alertTokens).criteria);
  };

  const onClear = () => {
    reset();
  };

  const onApplySavedSearch = async (search: { query: string }) => {
    const { criteria: appliedCriteria } = await applySavedSearch(
      search.query,
      'alert',
      legacyRuleListNameResolvers,
      (q) => parse(q, alertTokens).criteria,
      // Re-persisting the migrated form back onto the saved entry isn't exposed by
      // useGenericSavedSearches (it only renames/deletes/sets-default) - applying still
      // works against the migrated criteria below, just without updating storage.
      async () => {}
    );
    setCriteria(appliedCriteria);
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
      primaryAction={<AlertRulesHeaderActions />}
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
          <SavedSearches
            savedSearches={savedSearches.savedSearches}
            currentSearchQuery={query}
            onSave={savedSearches.saveSearch}
            onRename={savedSearches.renameSearch}
            onDelete={savedSearches.deleteSearch}
            onSetDefault={savedSearches.setDefaultSearch}
            isLoading={savedSearches.isLoading}
            onApply={onApplySavedSearch}
            getHref={(search) => `/alerting/rules/alert?search=${encodeURIComponent(search.query)}`}
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

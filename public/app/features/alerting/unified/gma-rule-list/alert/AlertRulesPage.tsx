import { useEffect, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Box, RadioButtonGroup, Stack } from '@grafana/ui';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertRulesHeaderActions } from '../actions/AlertRulesHeaderActions';
import { AlertRulesFilterSidebar } from '../search/AlertRulesFilterSidebar';
import { RuleSearchInput } from '../search/RuleSearchInput';
import { getCriteriaIssues } from '../search/criteriaIssues';
import { parse } from '../search/parser';
import { useAlertRulesSavedSearches } from '../search/savedSearches';
import { serialize } from '../search/serializer';
import { alertTokens } from '../search/tokenDefinitions';
import { type Criteria, createEmptyCriteria } from '../search/types';
import { type RuleListMode, useRuleListSearchState } from '../search/useRuleListSearchState';
import { ConnectedSavedSearches } from '../shared/ConnectedSavedSearches';
import { RulesPageShell } from '../shared/RulesPageShell';
import { SavedSearchesLoadingPlaceholder } from '../shared/SavedSearchesLoadingPlaceholder';
import { trackRuleListPageView } from '../shared/analytics';
import { legacyRuleListNameResolvers } from '../shared/nameResolvers';
import { useRuleListRefreshVersion } from '../shared/refreshRuleLists';
import { useLegacySavedSearchesCopied } from '../shared/useLegacySavedSearchesCopied';

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
  const savedSearchesReady = useLegacySavedSearchesCopied(legacyRuleListNameResolvers);

  const trackedView = useRef(false);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      trackRuleListPageView('alert', mode);
    }
    // Intentionally tracked once per mount with the mode at that time, not on every mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      primaryAction={<AlertRulesHeaderActions />}
    >
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} alignItems="center">
          <Box grow={1} minWidth={0}>
            <RuleSearchInput query={query} onApply={onApplyQuery} tokens={alertTokens} issues={issues} />
          </Box>
          <Box shrink={0}>
            <RadioButtonGroup
              value={mode}
              onChange={setMode}
              options={[
                {
                  icon: 'folder',
                  label: t('alerting.gma-rule-list.alert-rules.view-folders', 'Folders'),
                  value: 'folders',
                },
                { icon: 'list-ul', label: t('alerting.gma-rule-list.alert-rules.view-list', 'List'), value: 'list' },
              ]}
            />
          </Box>
          <Box shrink={0}>
            {savedSearchesReady ? (
              <ConnectedSavedSearches
                useSavedSearches={useAlertRulesSavedSearches}
                kind="alert"
                query={query}
                parseForKind={(q) => parse(q, alertTokens).criteria}
                resolvers={legacyRuleListNameResolvers}
                setCriteria={setCriteria}
                getHref={(search) => `/alerting/rules/alert?search=${encodeURIComponent(search.query)}`}
              />
            ) : (
              <SavedSearchesLoadingPlaceholder query={query} />
            )}
          </Box>
        </Stack>
        <Stack direction="row" gap={2}>
          <AlertRulesFilterSidebar
            criteria={criteria}
            onChange={setCriteria}
            onClear={onClear}
            hasActiveFilters={hasActiveFilters}
            issues={issues}
          />
          <Box grow={1} minWidth={0}>
            <AlertRulesBody canSearch={canSearch} mode={mode} criteria={criteria} resetKey={resetKey} />
          </Box>
        </Stack>
      </Stack>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(AlertRulesPage);

import { useEffect, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Box, Divider, Stack } from '@grafana/ui';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RulesPageShell } from '../page-shell/RulesPageShell';
import { RuleListModeToggle } from '../rule-search/RuleListModeToggle';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { alertTokens } from '../rule-search/alertTokens';
import { parse } from '../rule-search/parser';
import { type RuleSearchFilter, createEmptyFilter } from '../rule-search/ruleSearchFilter';
import { serialize } from '../rule-search/serializer';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { RuleListSavedSearchIndicator } from '../saved-searches/RuleListSavedSearchIndicator';
import { RuleListSavedSearches, useRuleListSavedSearches } from '../saved-searches/RuleListSavedSearches';
import { withSavedSearchesSetup } from '../saved-searches/withSavedSearchesSetup';
import { trackRuleListPageView } from '../shared/analytics';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';
import { FoldersView } from './AlertRulesFoldersView';
import { AlertRulesHeaderActions } from './AlertRulesHeaderActions';
import { ListView } from './AlertRulesListView';

function AlertRulesBody({
  canSearch,
  mode,
  filter,
}: {
  canSearch: boolean;
  mode: RuleListMode;
  filter: RuleSearchFilter;
}) {
  if (!canSearch) {
    return (
      <div role="alert">
        {t('alerting.gma-rule-list.alert-rules.invalid-filter', 'Fix the invalid filter to see results')}
      </div>
    );
  }
  if (mode === 'folders') {
    return <FoldersView folderUids={filter.namespaces} />;
  }
  return <ListView filter={filter} />;
}

function AlertRulesPage() {
  const { filter, issues, mode, hasNonFolderFilters, setFilter, setMode, reset } = useRuleListSearchState('alert');

  const trackedView = useRef(false);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      trackRuleListPageView('alert', mode);
    }
    // Once per mount, with the mode at that time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedSearches = useRuleListSavedSearches('alert');
  const query = serialize(filter);
  const hasActiveFilters = query !== serialize(createEmptyFilter());

  const onApplyQuery = (raw: string) => {
    setFilter(parse(raw, alertTokens));
  };

  // Skip the request and show the invalid-filter state when getFilterIssues() reports issues.
  const canSearch = issues.length === 0;

  return (
    <RulesPageShell
      navId="alert-rules"
      pageLabel={t('alerting.gma-rule-list.alert-rules.title', 'Alert rules')}
      activeTab="active"
      activeHref="/alerting/rules/alert"
      deletedHref="/alerting/rules/alert/deleted"
      primaryAction={<AlertRulesHeaderActions />}
    >
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <Stack direction="row" gap={2} alignItems="center">
            <Box grow={1} minWidth={0}>
              <RuleSearchInput
                query={query}
                onApply={onApplyQuery}
                tokens={alertTokens}
                issues={issues}
                labelSuffix={
                  <RuleListSavedSearchIndicator
                    kind="alert"
                    query={query}
                    savedSearches={savedSearches.savedSearches}
                  />
                }
              />
            </Box>
            <Box shrink={0}>
              <RuleListSavedSearches kind="alert" savedSearches={savedSearches} />
            </Box>
            <Box shrink={0}>
              <RuleListModeToggle mode={mode} onChange={setMode} foldersDisabled={hasNonFolderFilters} />
            </Box>
          </Stack>
          <Stack direction="row" gap={2}>
            <AlertRulesFilterSidebar
              filter={filter}
              onChange={setFilter}
              onClear={reset}
              hasActiveFilters={hasActiveFilters}
              issues={issues}
            />
            {/* The flex wrapper gives the divider a definite height to fill; on its own it collapses to zero. */}
            <Box display="flex">
              <Divider direction="vertical" spacing={0} />
            </Box>
            <Box grow={1} minWidth={0}>
              <AlertRulesBody canSearch={canSearch} mode={mode} filter={filter} />
            </Box>
          </Stack>
        </Stack>
      </Box>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(withSavedSearchesSetup('alert', AlertRulesPage));

import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { Box, RadioButtonGroup, Stack } from '@grafana/ui';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RecordingRulesHeaderActions } from '../actions/RecordingRulesHeaderActions';
import { RecordingRulesFilterSidebar } from '../search/RecordingRulesFilterSidebar';
import { RuleSearchInput } from '../search/RuleSearchInput';
import { getCriteriaIssues } from '../search/criteriaIssues';
import { parse } from '../search/parser';
import { useRecordingRulesSavedSearches } from '../search/savedSearches';
import { applySavedSearch, copyLegacySavedSearchesOnce } from '../search/savedSearchesMigration';
import { serialize } from '../search/serializer';
import { recordingTokens } from '../search/tokenDefinitions';
import { type Criteria, createEmptyCriteria } from '../search/types';
import { type RuleListMode, useRuleListSearchState } from '../search/useRuleListSearchState';
import { RulesPageShell } from '../shared/RulesPageShell';
import { legacyRuleListNameResolvers } from '../shared/nameResolvers';
import { useRuleListRefreshVersion } from '../shared/refreshRuleLists';

import { FoldersView } from './FoldersView';
import { ListView } from './ListView';

function RecordingRulesBody({
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
        {t('alerting.gma-rule-list.recording-rules.invalid-filter', 'Fix the invalid filter to see results')}
      </div>
    );
  }
  if (mode === 'folders') {
    return <FoldersView folderUids={criteria.namespaces} resetKey={resetKey} />;
  }
  return <ListView criteria={criteria} resetKey={resetKey} />;
}

function RecordingRulesPage() {
  const { criteria, mode, setCriteria, setMode, reset } = useRuleListSearchState('recording');
  const issues = getCriteriaIssues(criteria, 'recording');
  const refreshVersion = useRuleListRefreshVersion('recording');
  const savedSearches = useRecordingRulesSavedSearches();

  useEffect(() => {
    void copyLegacySavedSearchesOnce(legacyRuleListNameResolvers);
  }, []);

  const query = serialize(criteria);
  const hasActiveFilters = query !== serialize(createEmptyCriteria());

  const onApplyQuery = (raw: string) => {
    setCriteria(parse(raw, recordingTokens).criteria);
  };

  const onClear = () => {
    reset();
  };

  const onApplySavedSearch = async (search: { query: string }) => {
    const { criteria: appliedCriteria } = await applySavedSearch(
      search.query,
      'recording',
      legacyRuleListNameResolvers,
      (q) => parse(q, recordingTokens).criteria,
      async () => {}
    );
    setCriteria(appliedCriteria);
  };

  const canSearch = issues.length === 0;
  const resetKey = JSON.stringify([criteria, refreshVersion]);

  return (
    <RulesPageShell
      navId="recording-rules"
      pageLabel={t('alerting.gma-rule-list.recording-rules.title', 'Recording rules')}
      activeTab="active"
      activeHref="/alerting/rules/recording"
      deletedHref="/alerting/rules/recording/deleted"
      primaryAction={<RecordingRulesHeaderActions />}
    >
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} alignItems="center">
          <RuleSearchInput query={query} onApply={onApplyQuery} tokens={recordingTokens} issues={issues} />
          <RadioButtonGroup
            value={mode}
            onChange={setMode}
            options={[
              { label: t('alerting.gma-rule-list.recording-rules.view-folders', 'Folders'), value: 'folders' },
              { label: t('alerting.gma-rule-list.recording-rules.view-list', 'List'), value: 'list' },
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
            getHref={(search) => `/alerting/rules/recording?search=${encodeURIComponent(search.query)}`}
          />
        </Stack>
        <Stack direction="row" gap={2}>
          <RecordingRulesFilterSidebar
            criteria={criteria}
            onChange={setCriteria}
            onClear={onClear}
            hasActiveFilters={hasActiveFilters}
            issues={issues}
          />
          <Box flex={1} minWidth={0}>
            <RecordingRulesBody canSearch={canSearch} mode={mode} criteria={criteria} resetKey={resetKey} />
          </Box>
        </Stack>
      </Stack>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);

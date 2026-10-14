import { useEffect, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Box, Divider, RadioButtonGroup, Stack } from '@grafana/ui';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { legacyRuleListNameResolvers } from '../legacy-migration/nameResolvers';
import { RulesPageShell } from '../page-shell/RulesPageShell';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';
import { getCriteriaIssues } from '../rule-search/criteriaIssues';
import { parse } from '../rule-search/parser';
import { recordingTokens } from '../rule-search/recordingTokens';
import { serialize } from '../rule-search/serializer';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { ConnectedSavedSearches } from '../saved-searches/ConnectedSavedSearches';
import { SavedSearchesLoadingPlaceholder } from '../saved-searches/SavedSearchesLoadingPlaceholder';
import { useLegacySavedSearchesCopied } from '../saved-searches/useLegacySavedSearchesCopied';
import { trackRuleListPageView } from '../shared/analytics';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';
import { FoldersView } from './RecordingRulesFoldersView';
import { RecordingRulesHeaderActions } from './RecordingRulesHeaderActions';
import { ListView } from './RecordingRulesListView';
import { useRecordingRulesSavedSearches } from './recordingRulesSavedSearches';

function RecordingRulesBody({
  canSearch,
  mode,
  criteria,
}: {
  canSearch: boolean;
  mode: RuleListMode;
  criteria: Criteria;
}) {
  if (!canSearch) {
    return (
      <div role="alert">
        {t('alerting.gma-rule-list.recording-rules.invalid-filter', 'Fix the invalid filter to see results')}
      </div>
    );
  }
  if (mode === 'folders') {
    return <FoldersView folderUids={criteria.namespaces} />;
  }
  return <ListView criteria={criteria} />;
}

function RecordingRulesPage() {
  const { criteria, mode, setCriteria, setMode, reset } = useRuleListSearchState('recording');
  const issues = getCriteriaIssues(criteria, 'recording');
  const savedSearchesReady = useLegacySavedSearchesCopied(legacyRuleListNameResolvers);

  const trackedView = useRef(false);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      trackRuleListPageView('recording', mode);
    }
    // Intentionally tracked once per mount with the mode at that time, not on every mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = serialize(criteria);
  const hasActiveFilters = query !== serialize(createEmptyCriteria());

  const onApplyQuery = (raw: string) => {
    setCriteria(parse(raw, recordingTokens).criteria);
  };

  const onClear = () => {
    reset();
  };

  const canSearch = issues.length === 0;

  return (
    <RulesPageShell
      navId="recording-rules"
      pageLabel={t('alerting.gma-rule-list.recording-rules.title', 'Recording rules')}
      activeTab="active"
      activeHref="/alerting/rules/recording"
      deletedHref="/alerting/rules/recording/deleted"
      primaryAction={<RecordingRulesHeaderActions />}
    >
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <Stack direction="row" gap={2} alignItems="center">
            <Box grow={1} minWidth={0}>
              <RuleSearchInput query={query} onApply={onApplyQuery} tokens={recordingTokens} issues={issues} />
            </Box>
            <Box shrink={0}>
              {savedSearchesReady ? (
                <ConnectedSavedSearches
                  useSavedSearches={useRecordingRulesSavedSearches}
                  kind="recording"
                  query={query}
                  parseForKind={(q) => parse(q, recordingTokens).criteria}
                  resolvers={legacyRuleListNameResolvers}
                  setCriteria={setCriteria}
                  getHref={(search) => `/alerting/rules/recording?search=${encodeURIComponent(search.query)}`}
                />
              ) : (
                <SavedSearchesLoadingPlaceholder query={query} />
              )}
            </Box>
            <Box shrink={0}>
              <RadioButtonGroup
                value={mode}
                onChange={setMode}
                options={[
                  {
                    icon: 'folder',
                    label: t('alerting.gma-rule-list.recording-rules.view-folders', 'Folders'),
                    value: 'folders',
                  },
                  {
                    icon: 'list-ul',
                    label: t('alerting.gma-rule-list.recording-rules.view-list', 'List'),
                    value: 'list',
                  },
                ]}
              />
            </Box>
          </Stack>
          <Stack direction="row" gap={0}>
            <RecordingRulesFilterSidebar
              criteria={criteria}
              onChange={setCriteria}
              onClear={onClear}
              hasActiveFilters={hasActiveFilters}
              issues={issues}
            />
            {/* A stretched flex item has a definite height, which the divider's 100% needs to resolve. */}
            <Box display="flex">
              <Divider direction="vertical" spacing={2} />
            </Box>
            <Box grow={1} minWidth={0}>
              <RecordingRulesBody canSearch={canSearch} mode={mode} criteria={criteria} />
            </Box>
          </Stack>
        </Stack>
      </Box>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);

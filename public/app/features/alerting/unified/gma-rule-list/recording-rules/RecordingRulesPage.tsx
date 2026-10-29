import { t } from '@grafana/i18n';
import { Box, EmptyState, Stack } from '@grafana/ui';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RulesPageShell } from '../page-shell/RulesPageShell';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { useTrackRuleListPageView } from '../shared/analytics';

import { RecordingRulesHeaderActions } from './RecordingRulesHeaderActions';
import { RecordingRulesListView } from './RecordingRulesListView';
import { useRecordingRuleSearchRejection } from './recordingRuleSearch';

function RecordingRulesPage() {
  const { query, filter, parseIssues, filters, applyQuery } = useRuleListSearchState('recording');
  const rejectionIssues = useRecordingRuleSearchRejection(filter, { skip: parseIssues.length > 0 });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  useTrackRuleListPageView('recording', 'list');

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
          <RuleSearchInput query={query} onApply={applyQuery} filters={filters} issues={issues} />
          {issues.length > 0 ? (
            <EmptyState
              variant="not-found"
              message={t('alerting.gma-rule-list.recording-rules.search-issues', 'Change the search to see results')}
            />
          ) : (
            <RecordingRulesListView filter={filter} />
          )}
        </Stack>
      </Box>
    </RulesPageShell>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);

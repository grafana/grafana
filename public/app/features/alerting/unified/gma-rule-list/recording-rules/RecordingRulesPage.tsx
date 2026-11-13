import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Box, EmptyState, Stack, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useRecordingRulesNav } from '../../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RuleListModeToggle } from '../rule-search/RuleListModeToggle';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { useTrackRuleListPageView } from '../shared/analytics';

import { RecordingRulesFoldersView } from './RecordingRulesFoldersView';
import { RecordingRulesListView } from './RecordingRulesListView';
import { type RecordingRuleFilter, recordingRuleSearchSchema } from './recordingRuleFilters';
import { useRecordingRuleSearchRejection } from './recordingRuleSearch';

function RecordingRulesPage() {
  const { query, filter, parseIssues, filterHelp, mode, hasNonFolderFilters, applyQuery, setMode } =
    useRuleListSearchState(recordingRuleSearchSchema);
  const rejectionIssues = useRecordingRuleSearchRejection(filter, { parseIssues, mode });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  useTrackRuleListPageView('recording', mode);

  const { navId, pageNav } = useRecordingRulesNav();
  const headerHeight = useChromeHeaderHeight() ?? 0;
  const styles = useStyles2(getStyles, headerHeight);

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <div className={styles.searchRow}>
            <RuleSearchInput
              query={query}
              onApply={applyQuery}
              filterHelp={filterHelp}
              issues={issues}
              trailing={<RuleListModeToggle mode={mode} onChange={setMode} foldersDisabled={hasNonFolderFilters} />}
            />
          </div>
          <RecordingRulesBody hasIssues={issues.length > 0} mode={mode} filter={filter} />
        </Stack>
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(RecordingRulesPage);

interface RecordingRulesBodyProps {
  hasIssues: boolean;
  mode: RuleListMode;
  filter: RecordingRuleFilter;
}

function RecordingRulesBody({ hasIssues, mode, filter }: RecordingRulesBodyProps) {
  if (hasIssues) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.recording-rules.search-issues', 'Change the search to see results')}
      />
    );
  }
  if (mode === 'folders') {
    return <RecordingRulesFoldersView key={filter.folders.join()} folderUids={filter.folders} />;
  }
  return <RecordingRulesListView filter={filter} />;
}

const getStyles = (theme: GrafanaTheme2, headerHeight: number) => ({
  // Rows scroll under the search row, so it needs an opaque background and a spot below the app top bar.
  searchRow: css({
    position: 'sticky',
    top: headerHeight,
    zIndex: theme.zIndex.navbarFixed,
    background: theme.colors.background.page,
    padding: theme.spacing(1, 0),
  }),
});

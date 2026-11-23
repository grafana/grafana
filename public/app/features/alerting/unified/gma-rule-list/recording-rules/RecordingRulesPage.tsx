import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { EmptyState, LinkButton, Stack, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { useRecordingRulesNav } from '../../navigation/useAlertRulesNav';
import { grafanaRulesNav } from '../../utils/navigation';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { FilterSidebarLayout } from '../rule-search/FilterSidebar';
import { RuleListModeToggle } from '../rule-search/RuleListModeToggle';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { RuleSequenceDrawerProvider } from '../rule-sequences/RuleSequenceDrawer';
import { RuleListSavedSearchIndicator, RuleListSavedSearches } from '../saved-searches/RuleListSavedSearches';
import { useRuleListSavedSearches } from '../saved-searches/useRuleListSavedSearches';
import { withSavedSearchesSetup } from '../saved-searches/withSavedSearchesSetup';
import { useTrackRuleListPageView } from '../shared/analytics';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';
import { RecordingRulesFoldersView } from './RecordingRulesFoldersView';
import { RecordingRulesListView } from './RecordingRulesListView';
import { type RecordingRuleFilter, recordingRuleSearchSchema } from './recordingRuleFilters';
import { useRecordingRuleSearchRejection } from './recordingRuleSearch';

function RecordingRulesPage() {
  const { query, filter, parseIssues, filterHelp, mode, hasNonFolderFilters, applyQuery, setMode } =
    useRuleListSearchState(recordingRuleSearchSchema);
  const rejectionIssues = useRecordingRuleSearchRejection(filter, { parseIssues, mode });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  const savedSearches = useRuleListSavedSearches('recording');

  useTrackRuleListPageView('recording', mode);

  const { navId, pageNav } = useRecordingRulesNav();
  const headerHeight = useChromeHeaderHeight() ?? 0;
  const styles = useStyles2(getStyles, headerHeight);

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} actions={<RecordingRulesPageHeader />}>
      <Stack direction="column" gap={1}>
        <div className={styles.searchRow}>
          <RuleSearchInput
            query={query}
            onApply={applyQuery}
            filterHelp={filterHelp}
            issues={issues}
            appliedSavedSearch={
              <RuleListSavedSearchIndicator
                query={query}
                schema={recordingRuleSearchSchema}
                savedSearches={savedSearches.savedSearches}
              />
            }
            trailing={
              <Stack direction="row" gap={1} alignItems="center">
                <RuleListSavedSearches kind="recording" savedSearches={savedSearches} />
                <RuleListModeToggle mode={mode} onChange={setMode} foldersDisabled={hasNonFolderFilters} />
              </Stack>
            }
          />
        </div>
        <FilterSidebarLayout
          sidebar={<RecordingRulesFilterSidebar query={query} filter={filter} onApply={applyQuery} />}
        >
          <RuleSequenceDrawerProvider>
            <RecordingRulesBody hasIssues={issues.length > 0} mode={mode} filter={filter} />
          </RuleSequenceDrawerProvider>
        </FilterSidebarLayout>
      </Stack>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(withSavedSearchesSetup('recording', RecordingRulesPage));

function RecordingRulesPageHeader() {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed && config.unifiedAlerting.recordingRulesEnabled;

  if (!canCreate) {
    return null;
  }

  return (
    <LinkButton href={grafanaRulesNav.newRecordingRuleLink()} icon="plus" variant="primary">
      <Trans i18nKey="alerting.gma-rule-list.recording-rules.header.new-rule">New recording rule</Trans>
    </LinkButton>
  );
}

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
    return (
      <RecordingRulesFoldersView
        key={JSON.stringify([filter.folder, filter.folderUids])}
        scope={{ folder: filter.folder, folderUids: filter.folderUids }}
      />
    );
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
    paddingBottom: theme.spacing(1),
  }),
});

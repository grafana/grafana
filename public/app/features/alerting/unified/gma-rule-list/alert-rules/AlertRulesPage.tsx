import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Box, EmptyState, Stack, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RuleListModeToggle } from '../rule-search/RuleListModeToggle';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { type RuleSearchFilter } from '../rule-search/ruleSearchFilter';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { useTrackRuleListPageView } from '../shared/analytics';

import { AlertRulesFoldersView } from './AlertRulesFoldersView';
import { AlertRulesListView } from './AlertRulesListView';
import { useAlertRuleSearchRejection } from './alertRuleSearch';

function AlertRulesPage() {
  const { query, filter, parseIssues, filters, mode, hasNonFolderFilters, applyQuery, setMode } =
    useRuleListSearchState('alert');
  const rejectionIssues = useAlertRuleSearchRejection(filter, { parseIssues, mode });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  useTrackRuleListPageView('alert', mode);

  const headerHeight = useChromeHeaderHeight() ?? 0;
  const styles = useStyles2(getStyles, headerHeight);

  return (
    // The heading comes from the navId, so it also drives breadcrumbs and nav highlighting.
    <AlertingPageWrapper navId="alert-rules">
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <div className={styles.searchRow}>
            <RuleSearchInput
              query={query}
              onApply={applyQuery}
              filters={filters}
              issues={issues}
              trailing={<RuleListModeToggle mode={mode} onChange={setMode} foldersDisabled={hasNonFolderFilters} />}
            />
          </div>
          <AlertRulesBody hasIssues={issues.length > 0} mode={mode} filter={filter} />
        </Stack>
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertRulesPage);

interface AlertRulesBodyProps {
  hasIssues: boolean;
  mode: RuleListMode;
  filter: RuleSearchFilter;
}

function AlertRulesBody({ hasIssues, mode, filter }: AlertRulesBodyProps) {
  if (hasIssues) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.alert-rules.search-issues', 'Change the search to see results')}
      />
    );
  }
  if (mode === 'folders') {
    return <AlertRulesFoldersView key={filter.folders.join()} folderUids={filter.folders} />;
  }
  return <AlertRulesListView filter={filter} />;
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

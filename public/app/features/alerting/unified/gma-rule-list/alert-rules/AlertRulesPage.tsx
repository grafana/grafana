import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Box, Divider, Dropdown, EmptyState, LinkButton, Menu, Stack, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import MoreButton from '../../components/MoreButton';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';
import { grafanaRulesNav } from '../../utils/navigation';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { RuleListModeToggle } from '../rule-search/RuleListModeToggle';
import { RuleSearchInput } from '../rule-search/RuleSearchInput';
import { type RuleListMode, useRuleListSearchState } from '../rule-search/useRuleListSearchState';
import { RuleSequenceDrawerProvider } from '../rule-sequences/RuleSequenceDrawer';
import { RuleListSavedSearches } from '../saved-searches/RuleListSavedSearches';
import { useRuleListSavedSearches } from '../saved-searches/useRuleListSavedSearches';
import { withSavedSearchesSetup } from '../saved-searches/withSavedSearchesSetup';
import { useTrackRuleListPageView } from '../shared/analytics';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';
import { AlertRulesFoldersView } from './AlertRulesFoldersView';
import { AlertRulesListView } from './AlertRulesListView';
import { type AlertRuleFilter, alertRuleSearchSchema } from './alertRuleFilters';
import { useAlertRuleSearchRejection } from './alertRuleSearch';

function AlertRulesPage() {
  const { query, filter, parseIssues, filterHelp, mode, hasNonFolderFilters, applyQuery, setMode } =
    useRuleListSearchState(alertRuleSearchSchema);
  const rejectionIssues = useAlertRuleSearchRejection(filter, { parseIssues, mode });
  const issues = parseIssues.length > 0 ? parseIssues : rejectionIssues;

  const savedSearches = useRuleListSavedSearches('alert');

  useTrackRuleListPageView('alert', mode);

  const { navId, pageNav } = useAlertRulesNav();
  const headerHeight = useChromeHeaderHeight() ?? 0;
  const styles = useStyles2(getStyles, headerHeight);

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} actions={<AlertRulesPageHeader />}>
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <div className={styles.searchRow}>
            <RuleSearchInput
              query={query}
              onApply={applyQuery}
              filterHelp={filterHelp}
              issues={issues}
              trailing={
                <Stack direction="row" gap={1} alignItems="center">
                  <RuleListSavedSearches
                    kind="alert"
                    query={query}
                    onApply={applyQuery}
                    savedSearches={savedSearches}
                  />
                  <RuleListModeToggle mode={mode} onChange={setMode} foldersDisabled={hasNonFolderFilters} />
                </Stack>
              }
            />
          </div>
          <Stack direction="row" gap={2}>
            <AlertRulesFilterSidebar query={query} filter={filter} onApply={applyQuery} />
            <Divider direction="vertical" spacing={0} />
            <Box flex={1} minWidth={0}>
              <RuleSequenceDrawerProvider>
                <AlertRulesBody hasIssues={issues.length > 0} mode={mode} filter={filter} />
              </RuleSequenceDrawerProvider>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(withSavedSearchesSetup('alert', AlertRulesPage));

function AlertRulesPageHeader() {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  const moreMenu = (
    <Menu>
      <Menu.Item
        label={t('alerting.gma-rule-list.header.design-for-provisioning', 'Design rule for provisioning')}
        icon="download-alt"
        url={grafanaRulesNav.designForProvisioningLink()}
      />
    </Menu>
  );

  return (
    <Stack direction="row" gap={1} alignItems="center">
      {canCreate && (
        <LinkButton href={grafanaRulesNav.newAlertRuleLink()} icon="plus" variant="primary">
          <Trans i18nKey="alerting.gma-rule-list.header.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      )}
      <Dropdown overlay={moreMenu}>
        <MoreButton />
      </Dropdown>
    </Stack>
  );
}

interface AlertRulesBodyProps {
  hasIssues: boolean;
  mode: RuleListMode;
  filter: AlertRuleFilter;
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

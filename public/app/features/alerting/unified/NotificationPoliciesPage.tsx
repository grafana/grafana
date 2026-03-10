import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, LoadingPlaceholder, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { PoliciesList } from 'app/features/alerting/unified/components/notification-policies/PoliciesList';
import { PoliciesTree } from 'app/features/alerting/unified/components/notification-policies/PoliciesTree';
import { CreateModal } from 'app/features/alerting/unified/components/notification-policies/components/Modals';
import {
  useCreatePolicyAction,
  useListNotificationPolicyRoutes,
} from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { Route } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { InhibitionRulesAlert } from './components/InhibitionRulesAlert';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import { useNotificationPoliciesNav } from './navigation/useNotificationConfigNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  TimeIntervals = 'time_intervals',
}

const NotificationPoliciesTabs = () => {
  const styles = useStyles2(getStyles);

  // When V2 navigation is enabled, Time Intervals has its own dedicated tab in the navigation,
  // so we don't show local tabs here - just show the notification policies content directly
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // Alertmanager logic and data hooks
  const { selectedAlertmanager = '' } = useAlertmanager();
  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);
  const [timingsSupported, canSeeTimingsTab] = useAlertmanagerAbility(AlertmanagerAction.ViewTimeInterval);
  const availableTabs = [
    canSeePoliciesTab && ActiveTab.NotificationPolicies,
    canSeeTimingsTab && ActiveTab.TimeIntervals,
  ].filter((tab) => !!tab);
  const { data: muteTimings = [] } = useMuteTimings({
    alertmanager: selectedAlertmanager,
    skip: !canSeeTimingsTab,
  });

  // Tab state management
  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams, availableTabs[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  const muteTimingsTabActive = activeTab === ActiveTab.TimeIntervals;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  const numberOfMuteTimings = muteTimings.length;

  // V2 Navigation: No local tabs, just show notification policies content
  if (useV2Nav) {
    return (
      <>
        <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
        <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
        <PolicyTreeTab />
      </>
    );
  }

  // Legacy Navigation: Show local tabs for Notification Policies and Time Intervals
  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
      <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
      <TabsBar>
        {policiesSupported && canSeePoliciesTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-notification-policies', 'Notification Policies')}
            active={policyTreeTabActive}
            onChangeTab={() => {
              setActiveTab(ActiveTab.NotificationPolicies);
              setQueryParams({ tab: ActiveTab.NotificationPolicies });
            }}
          />
        )}
        {timingsSupported && canSeeTimingsTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-time-intervals', 'Time intervals')}
            active={muteTimingsTabActive}
            counter={numberOfMuteTimings}
            onChangeTab={() => {
              setActiveTab(ActiveTab.TimeIntervals);
              setQueryParams({ tab: ActiveTab.TimeIntervals });
            }}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {policyTreeTabActive && <PolicyTreeTab />}
        {muteTimingsTabActive && <TimeIntervalsTable />}
      </TabContent>
    </>
  );
};

const PolicyTreeTab = () => {
  const { isGrafanaAlertmanager } = useAlertmanager();

  const useMultiplePoliciesView = config.featureToggles.alertingMultiplePolicies;

  if (!isGrafanaAlertmanager || !useMultiplePoliciesView) {
    return <PoliciesTree />;
  }

  return <MultiplePoliciesView />;
};

/**
 * When multiple policies are enabled, decide whether to show the full list
 * or the single-tree view with a "New notification policy" button.
 */
function MultiplePoliciesView() {
  const { currentData: allPolicies, isLoading } = useListNotificationPolicyRoutes();

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.policies-list.text-loading', 'Loading....')} />;
  }

  // allPolicies is undefined on error — PoliciesList handles error UI
  if (!allPolicies || allPolicies.length > 1) {
    return <PoliciesList />;
  }

  return <SinglePolicyView allPolicies={allPolicies} />;
}

/**
 * Shows the default policy tree inline with a button to create additional policy trees.
 * Used when there's only one routing tree so users don't have to click through a list.
 */
function SinglePolicyView({ allPolicies }: { allPolicies: Route[] }) {
  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    createPoliciesSupported,
    createPoliciesAllowed,
    createTrigger,
    existingPolicyNames,
  } = useCreatePolicyAction(allPolicies);

  return (
    <Stack direction="column" gap={2}>
      {createPoliciesSupported && (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            data-testid="create-policy-button"
            icon="plus"
            aria-label={t('alerting.policies-list.create.aria-label', 'add policy')}
            variant="primary"
            disabled={!createPoliciesAllowed}
            onClick={openCreateModal}
          >
            <Trans i18nKey="alerting.policies-list.create.text">New notification policy</Trans>
          </Button>
        </Stack>
      )}
      <PoliciesTree />
      <CreateModal
        existingPolicyNames={existingPolicyNames}
        isOpen={isCreateModalOpen}
        onConfirm={(route) => createTrigger.execute(route)}
        onDismiss={closeCreateModal}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    marginTop: theme.spacing(2),
  }),
});

interface QueryParamValues {
  tab: ActiveTab;
}

function getActiveTabFromUrl(queryParams: UrlQueryMap, defaultTab: ActiveTab): QueryParamValues {
  let tab = defaultTab;

  if (queryParams.tab === ActiveTab.NotificationPolicies) {
    tab = ActiveTab.NotificationPolicies;
  }

  if (queryParams.tab === ActiveTab.TimeIntervals) {
    tab = ActiveTab.TimeIntervals;
  }

  return {
    tab,
  };
}

function NotificationPoliciesPage() {
  const { navId, pageNav } = useNotificationPoliciesNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <NotificationPoliciesTabs />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationPoliciesPage);

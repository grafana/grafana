import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Tab, TabContent, TabsBar, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { NotificationPoliciesList } from 'app/features/alerting/unified/components/notification-policies/NotificationPoliciesList';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { MuteTimingsTable } from './components/mute-timings/MuteTimingsTable';
import { useAlertmanager } from './state/AlertmanagerContext';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  MuteTimings = 'mute_timings',
}

const NotificationPoliciesTabs = () => {
  const styles = useStyles2(getStyles);

  // Alertmanager logic and data hooks
  const { selectedAlertmanager = '' } = useAlertmanager();
  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);
  const [timingsSupported, canSeeTimingsTab] = useAlertmanagerAbility(AlertmanagerAction.ViewMuteTiming);
  const availableTabs = [
    canSeePoliciesTab && ActiveTab.NotificationPolicies,
    canSeeTimingsTab && ActiveTab.MuteTimings,
  ].filter((tab) => !!tab);
  const { data: muteTimings = [] } = useMuteTimings({
    alertmanager: selectedAlertmanager,
    skip: !canSeeTimingsTab,
  });

  // Tab state management
  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams, availableTabs[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  const muteTimingsTabActive = activeTab === ActiveTab.MuteTimings;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  const numberOfMuteTimings = muteTimings.length;

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager} />
      <TabsBar>
        {policiesSupported && canSeePoliciesTab && (
          <Tab
            label={'Notification Policies'}
            active={policyTreeTabActive}
            onChangeTab={() => {
              setActiveTab(ActiveTab.NotificationPolicies);
              setQueryParams({ tab: ActiveTab.NotificationPolicies });
            }}
          />
        )}
        {timingsSupported && canSeeTimingsTab && (
          <Tab
            label={'Mute Timings'}
            active={muteTimingsTabActive}
            counter={numberOfMuteTimings}
            onChangeTab={() => {
              setActiveTab(ActiveTab.MuteTimings);
              setQueryParams({ tab: ActiveTab.MuteTimings });
            }}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {policyTreeTabActive && <NotificationPoliciesList />}
        {muteTimingsTabActive && <MuteTimingsTable />}
      </TabContent>
    </>
  );
};

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

  if (queryParams.tab === ActiveTab.MuteTimings) {
    tab = ActiveTab.MuteTimings;
  }

  return {
    tab,
  };
}

const NotificationPoliciesPage = () => (
  <AlertmanagerPageWrapper navId="am-routes" accessType="notification">
    <NotificationPoliciesTabs />
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NotificationPoliciesPage, { style: 'page' });

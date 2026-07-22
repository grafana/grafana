import { css } from '@emotion/css';
import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { ScrollContainer, Stack, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { FiringAlertsCardView } from './FiringAlertsCard';
import { canViewFiringAlerts, useFiringAlerts } from './useFiringAlerts';

const ALERTS_TAB_ID = 'firing-alerts';

export function AlertIncidentTabs() {
  const canViewAlerts = canViewFiringAlerts();

  // TODO: Check for incident plugin and show incidents tab if it is available
  if (!canViewAlerts) {
    return null;
  }

  return <AlertIncidentTabsInner />;
}

function AlertIncidentTabsInner() {
  const [activeTab, setActiveTab] = useState(ALERTS_TAB_ID);
  const styles = useStyles2(getStyles);
  const alertsData = useFiringAlerts();
  const { count, hasAlerts, loading, canCreate, newRuleHref, viewAllHref, error } = alertsData;
  const isAlertActionsVisible = !loading && !error && activeTab === ALERTS_TAB_ID;

  const tabs = [
    {
      id: ALERTS_TAB_ID,
      label: t('home.alerts-incidents.alert-tab-label', 'Firing alerts'),
      // Undefined while loading so the counter doesn't flash 0 before the alerts arrive.
      counter: loading ? undefined : count,
    },
  ];
  return (
    <Stack direction="column" gap={2} minWidth={0}>
      <Stack justifyContent="space-between" alignItems="center">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.alerts-incidents.title">Alerts & incidents</Trans>
        </Text>
        {/* TODO: team dropdown */}
      </Stack>

      <HomeSection paddingX={2} paddingY={1} display="flex" direction="column" grow={1}>
        <TabsBar>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              counter={tab.counter}
              onChangeTab={() => {
                setActiveTab(tab.id);
                tabChanged({ tab: tab.id });
              }}
            />
          ))}
        </TabsBar>
        <TabContent className={styles.redesignedTabContent}>
          <ScrollContainer
            showScrollIndicators
            maxHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN}px`}
            minHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN}px`}
          >
            {activeTab === ALERTS_TAB_ID && <FiringAlertsCardView data={alertsData} hideFooterActions />}
          </ScrollContainer>

          {/* Alerts tab footer */}
          {isAlertActionsVisible && (
            <CreateAndViewAlertsButtons
              hasAlerts={hasAlerts}
              canCreate={canCreate}
              newRuleHref={newRuleHref}
              viewAllHref={viewAllHref}
            />
          )}
        </TabContent>
      </HomeSection>
    </Stack>
  );
}

const getStyles = () => ({
  redesignedTabContent: css({
    padding: 0,
  }),
});

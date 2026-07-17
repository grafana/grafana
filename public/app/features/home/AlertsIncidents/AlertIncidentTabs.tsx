import { css } from '@emotion/css';
import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { ScrollContainer, Stack, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { canViewFiringAlerts, FiringAlertsCard } from './FiringAlertsCard';

const ALERTS_TAB_ID = 'firing-alerts';

export function AlertIncidentTabs() {
  const canViewAlerts = canViewFiringAlerts();

  if (!canViewAlerts) {
    return null;
  }

  return <AlertIncidentTabsInner />;
}

function AlertIncidentTabsInner() {
  const [activeTab, setActiveTab] = useState(ALERTS_TAB_ID);
  const styles = useStyles2(getStyles);

  const tabs = [{ id: ALERTS_TAB_ID, label: t('home.firing-alerts-card.title', 'Firing alerts') }];
  return (
    <Stack direction="column" gap={2}>
      <Stack justifyContent="space-between">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.dashboards.title">Firing alerts</Trans>
        </Text>
      </Stack>

      <HomeSection paddingX={2} paddingY={1}>
        <TabsBar>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              //   counter={tab.counter}
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
            {activeTab === ALERTS_TAB_ID && <FiringAlertsCard />}
          </ScrollContainer>
        </TabContent>
      </HomeSection>
    </Stack>
  );
}

const getStyles = () => ({
  redesignedTabContent: css({
    // padding: 0,
  }),
});

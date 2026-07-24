import { css } from '@emotion/css';
import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { FiringAlertsCardView } from './FiringAlertsCard';
import { IncidentsCardView } from './IncidentsCard';
import { canViewFiringAlerts, useFiringAlerts } from './useFiringAlerts';
import { useIncidents } from './useIncidents';

const ALERTS_TAB_ID = 'firing-alerts';
const INCIDENTS_TAB_ID = 'incidents';

export function AlertIncidentTabs() {
  const { installed, loading } = useIrmPlugin(SupportedPlugin.Incident);
  const canViewIncidents = Boolean(installed && !loading);
  const canViewAlerts = canViewFiringAlerts();

  // Hide the tabs if neither alerts nor incidents are available
  if (!canViewAlerts && !canViewIncidents) {
    return null;
  }

  return <AlertIncidentTabsInner canViewAlerts={canViewAlerts} canViewIncidents={canViewIncidents} />;
}

function AlertIncidentTabsInner({
  canViewAlerts,
  canViewIncidents,
}: {
  canViewAlerts: boolean;
  canViewIncidents: boolean;
}) {
  // Default to alerts tab if alerts are available, otherwise default to incidents tab
  const [activeTab, setActiveTab] = useState(canViewAlerts ? ALERTS_TAB_ID : INCIDENTS_TAB_ID);
  const styles = useStyles2(getStyles);
  const alertsData = useFiringAlerts();
  const incidentsData = useIncidents();
  const { count, hasAlerts, loading, canCreate, newRuleHref, viewAllHref, error } = alertsData;
  const {
    loading: incidentsLoading,
    error: incidentsError,
    count: incidentsCount,
    hasMore: incidentsHasMore,
    pluginId: incidentsPluginId,
    canDeclare: incidentsCanDeclare,
    canAccess: incidentsCanAccess,
  } = incidentsData;
  const isAlertActionsVisible = canViewAlerts && !loading && !error && activeTab === ALERTS_TAB_ID;
  const isIncidentsActionsVisible =
    canViewIncidents && !incidentsLoading && !incidentsError && activeTab === INCIDENTS_TAB_ID;

  const tabs = [
    ...(canViewAlerts
      ? [
          {
            id: ALERTS_TAB_ID,
            label: t('home.alerts-incidents.alert-tab-label', 'Firing alerts'),
            // Undefined while loading so the counter doesn't flash 0 before the alerts arrive.
            counter: loading ? undefined : count,
          },
        ]
      : []),
    ...(canViewIncidents
      ? [
          {
            id: INCIDENTS_TAB_ID,
            label: t('home.alerts-incidents.incident-tab-label', 'Incidents'),
            // Undefined while loading so the counter doesn't flash 0 before the incidents arrive.
            // When the server truncated the result (hasMore), bump the counter past the limit so
            // the strictly-greater-than cap renders "{limit}+" instead of the misleading exact count.
            counter: incidentsLoading ? undefined : incidentsHasMore ? incidentsCount + 1 : incidentsCount,
            counterCappedAt: ACTIVE_INCIDENTS_QUERY_LIMIT,
          },
        ]
      : []),
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
              counterCappedAt={tab.counterCappedAt}
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
            {activeTab === INCIDENTS_TAB_ID && <IncidentsCardView data={incidentsData} hideFooterActions />}
          </ScrollContainer>

          <Box paddingTop={1.5}>
            {/* Alerts tab footer */}
            {isAlertActionsVisible && (
              <CreateAndViewAlertsButtons
                hasAlerts={hasAlerts}
                canCreate={canCreate}
                newRuleHref={newRuleHref}
                viewAllHref={viewAllHref}
              />
            )}

            {/* Incidents tab footer */}
            {isIncidentsActionsVisible && (
              <DeclareAndViewIncidentsButtons
                pluginId={incidentsPluginId}
                hasIncidents={incidentsData.count > 0}
                canDeclare={incidentsCanDeclare}
                canAccess={incidentsCanAccess}
              />
            )}
          </Box>
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

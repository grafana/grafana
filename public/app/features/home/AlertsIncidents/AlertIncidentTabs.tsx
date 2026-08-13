import { useImperativeHandle, useRef, useState, type Ref } from 'react';

import { t } from '@grafana/i18n';
import { Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { FiringAlertsCard } from './FiringAlertsCard';
import { IncidentsCard } from './IncidentsCard';
import { TeamFilterCombobox } from './TeamFilterCombobox';
import { type FiringAlertsData } from './useFiringAlerts';
import { type IncidentsData } from './useIncidents';

export const ALERTS_TAB_ID = 'firing-alerts' as const;
export const INCIDENTS_TAB_ID = 'incidents' as const;

type TabId = typeof ALERTS_TAB_ID | typeof INCIDENTS_TAB_ID;
export type AlertIncidentSwitchHandle = {
  switch: (tab: TabId, scroll?: boolean) => void;
};

export function AlertIncidentTabs({
  alertsData,
  incidentsData,
  team,
  setTeam,
  switchRef,
}: {
  alertsData: FiringAlertsData;
  incidentsData: IncidentsData;
  team: string | undefined;
  setTeam: (team: string | undefined) => void;
  switchRef?: Ref<AlertIncidentSwitchHandle>;
}) {
  const canViewIncidents = !!incidentsData.enabled;
  const canViewAlerts = alertsData.enabled;

  // Default to alerts tab if alerts are available, otherwise default to incidents tab
  const [activeTab, setActiveTab] = useState<TabId>(canViewAlerts ? ALERTS_TAB_ID : INCIDENTS_TAB_ID);
  const { count, hasAlerts, hasTeams, loading, canCreate, newRuleHref, viewAllHref, error } = alertsData;
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

  const containerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    switchRef,
    () => ({
      switch: (tab: TabId, scroll = true) => {
        setActiveTab(tab);
        if (scroll) {
          containerRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      },
    }),
    []
  );

  // Hide the tabs if neither alerts nor incidents are available
  if (!canViewAlerts && !canViewIncidents) {
    return null;
  }

  const title =
    canViewAlerts && canViewIncidents
      ? t('home.alerts-incidents.title', 'Alerts & incidents')
      : canViewIncidents
        ? t('home.alerts-incidents.title-incidents', 'Incidents')
        : t('home.alerts-incidents.title-alerts', 'Alerts');

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
    <Stack direction="column" gap={1} minWidth={0} ref={containerRef}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          {title}
        </Text>
        {canViewAlerts && (
          // Hidden rather than unmounted on the Incidents tab, so the combobox keeps
          // its fetched team values instead of refetching them on every tab switch.
          <div hidden={activeTab !== ALERTS_TAB_ID}>
            <TeamFilterCombobox selectedTeam={team} onChange={setTeam} userHasTeams={hasTeams} />
          </div>
        )}
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
        <TabContent>
          <ScrollContainer
            showScrollIndicators
            maxHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN}px`}
            minHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN}px`}
          >
            {activeTab === ALERTS_TAB_ID && <FiringAlertsCard data={alertsData} hideFooterActions />}
            {activeTab === INCIDENTS_TAB_ID && <IncidentsCard data={incidentsData} hideFooterActions />}
          </ScrollContainer>

          <Box padding={1} paddingTop={1.5}>
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

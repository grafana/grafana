import { useImperativeHandle, useRef, useState, type Ref } from 'react';

import { t } from '@grafana/i18n';
import { Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { FiringAlertsCardView } from './FiringAlertsCard';
import { IncidentsCardView } from './IncidentsCard';
import { TeamFilterCombobox } from './TeamFilterCombobox';
import { canViewFiringAlerts, useFiringAlerts } from './useFiringAlerts';
import { useIncidents } from './useIncidents';

export const ALERTS_TAB_ID = 'firing-alerts' as const;
export const INCIDENTS_TAB_ID = 'incidents' as const;

type TabId = typeof ALERTS_TAB_ID | typeof INCIDENTS_TAB_ID;
export type AlertIncidentSwitchHandle = {
  switch: (tab: TabId, scroll?: boolean) => void;
};

export function AlertIncidentTabs({ switchRef }: { switchRef?: Ref<AlertIncidentSwitchHandle> }) {
  const { installed, loading } = usePluginBridge(SupportedPlugin.Irm);
  const canViewIncidents = Boolean(installed && !loading);
  const canViewAlerts = canViewFiringAlerts();

  // Hide the tabs if neither alerts nor incidents are available
  if (!canViewAlerts && !canViewIncidents) {
    return null;
  }

  return (
    <AlertIncidentTabsInner canViewAlerts={canViewAlerts} canViewIncidents={canViewIncidents} switchRef={switchRef} />
  );
}

function AlertIncidentTabsInner({
  canViewAlerts,
  canViewIncidents,
  switchRef,
}: {
  canViewAlerts: boolean;
  canViewIncidents: boolean;
  switchRef?: Ref<AlertIncidentSwitchHandle>;
}) {
  // Default to alerts tab if alerts are available, otherwise default to incidents tab
  const [activeTab, setActiveTab] = useState<TabId>(canViewAlerts ? ALERTS_TAB_ID : INCIDENTS_TAB_ID);
  // Kept across tab switches so returning to the Alerts tab restores the filter.
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>();
  const alertsData = useFiringAlerts(selectedTeam);
  const incidentsData = useIncidents();
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
  useImperativeHandle(switchRef, () => ({
    switch: (tab: TabId, scroll = true) => {
      setActiveTab(tab);
      if (scroll) {
        containerRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    },
  }));

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
            <TeamFilterCombobox selectedTeam={selectedTeam} onChange={setSelectedTeam} userHasTeams={hasTeams} />
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
            {activeTab === ALERTS_TAB_ID && <FiringAlertsCardView data={alertsData} hideFooterActions />}
            {activeTab === INCIDENTS_TAB_ID && <IncidentsCardView data={incidentsData} hideFooterActions />}
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

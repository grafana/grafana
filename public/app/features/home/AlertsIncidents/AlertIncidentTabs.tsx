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
import { type TeamSelection } from './teamFilter';
import { useAlertTeamLabelValues } from './useAlertTeamLabelValues';
import { type FiringAlertsData } from './useFiringAlerts';
import { useIncidentTeamValues } from './useIncidentTeamValues';
import { type IncidentsData } from './useIncidents';

export const ALERTS_TAB_ID = 'firing-alerts' as const;
export const INCIDENTS_TAB_ID = 'incidents' as const;

type TabId = typeof ALERTS_TAB_ID | typeof INCIDENTS_TAB_ID;

// Prefixed because these land in the global DOM id namespace, and the bare tab ids are
// generic enough to collide with plugin content on the same page.
const PANEL_ID = 'alerts-incidents-panel';
const tabElementId = (id: TabId) => `alerts-incidents-tab-${id}`;

export type AlertIncidentSwitchHandle = {
  switch: (tab: TabId, scroll?: boolean) => void;
};

export function AlertIncidentTabs({
  alertsData,
  incidentsData,
  alertsTeam,
  onAlertsTeamChange,
  incidentsTeam,
  onIncidentsTeamChange,
  switchRef,
}: {
  alertsData: FiringAlertsData;
  incidentsData: IncidentsData;
  alertsTeam: TeamSelection;
  onAlertsTeamChange: (team: TeamSelection) => void;
  incidentsTeam: TeamSelection;
  onIncidentsTeamChange: (team: TeamSelection) => void;
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
  // Fetched here rather than in the dropdown so the values survive tab switches.
  const alertTeamValues = useAlertTeamLabelValues(canViewAlerts);
  const incidentTeamValues = useIncidentTeamValues(canViewIncidents);

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

  // Each tab keeps its own team selection: the two option lists rarely match, so a shared
  // pick would often name a team the other tab's field can't hold.
  const tabs = [
    ...(canViewAlerts
      ? [
          {
            id: ALERTS_TAB_ID,
            label: t('home.alerts-incidents.alert-tab-label', 'Firing alerts'),
            // Undefined while loading so the counter doesn't flash 0 before the alerts arrive.
            counter: loading ? undefined : count,
            teamFilter: {
              teamValues: alertTeamValues,
              selectedTeam: alertsTeam,
              onChange: onAlertsTeamChange,
              offersYourTeams: hasTeams,
              ariaLabel: t('home.alerts-incidents.team-filter-label', 'Filter alerts by team'),
            },
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
            teamFilter: {
              teamValues: incidentTeamValues,
              selectedTeam: incidentsTeam,
              onChange: onIncidentsTeamChange,
              // Incidents have no "your teams" scope: the unfiltered default is every active incident.
              offersYourTeams: false,
              ariaLabel: t('home.alerts-incidents.team-filter-label-incidents', 'Filter incidents by team'),
            },
          },
        ]
      : []),
  ];
  const teamFilter = tabs.find((tab) => tab.id === activeTab)?.teamFilter;

  return (
    <Stack direction="column" gap={1} minWidth={0} ref={containerRef}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          {title}
        </Text>
      </Stack>

      <HomeSection paddingX={2} paddingY={1} display="flex" direction="column" grow={1}>
        <TabsBar>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tabElementId(tab.id)}
              aria-controls={PANEL_ID}
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
        <TabContent id={PANEL_ID} role="tabpanel" aria-labelledby={tabElementId(activeTab)}>
          {/* Fixed height so the section doesn't jump between tabs; the list fills whatever the filter row leaves. */}
          <Box display="flex" direction="column" height={`${DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN}px`}>
            {teamFilter && teamFilter.teamValues.length > 0 && (
              <Box paddingTop={2}>
                <TeamFilterCombobox {...teamFilter} />
              </Box>
            )}
            <ScrollContainer showScrollIndicators>
              {activeTab === ALERTS_TAB_ID && <FiringAlertsCard data={alertsData} hideFooterActions />}
              {activeTab === INCIDENTS_TAB_ID && <IncidentsCard data={incidentsData} hideFooterActions />}
            </ScrollContainer>
          </Box>

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

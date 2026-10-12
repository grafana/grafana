import { useImperativeHandle, useRef, type Ref } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Badge, Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';

import { DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from '../DashboardTabs/types';
import { FooterAction, FooterActions } from '../FooterActions';
import { HomeSection } from '../HomeSection';
import { ctaClicked, tabChanged } from '../analytics/main';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { FiringAlertsCard } from './FiringAlertsCard';
import { IncidentsCard } from './IncidentsCard';
import { LabelFilterCombobox } from './LabelFilterCombobox';
import { OnCallCard } from './OnCallCard';
import { type FilterSelection } from './filterSelection';
import { useAlertFilterOptions } from './useAlertFilterOptions';
import { type FiringAlertsData } from './useFiringAlerts';
import { useIncidentFilterOptions } from './useIncidentFilterOptions';
import { type IncidentsData } from './useIncidents';
import { useOnCallSchedules } from './useOnCallSchedules';

export const ALERTS_TAB_ID = 'firing-alerts' as const;
export const INCIDENTS_TAB_ID = 'incidents' as const;
export const ON_CALL_TAB_ID = 'on-call' as const;

type TabId = typeof ALERTS_TAB_ID | typeof INCIDENTS_TAB_ID | typeof ON_CALL_TAB_ID;

// Survives reloads; the filters next to it use the same `grafana.home.*` key convention.
export const ALERTS_INCIDENTS_TAB_STORAGE_KEY = 'grafana.home.alertsIncidents.tab';

// Prefixed because these land in the global DOM id namespace, and the bare tab ids are
// generic enough to collide with plugin content on the same page.
const PANEL_ID = 'alerts-incidents-panel';
const tabElementId = (id: TabId) => `alerts-incidents-tab-${id}`;

export type AlertIncidentSwitchHandle = {
  switch: (tab: TabId, scroll?: boolean) => void;
};

/** The remembered tab when it is currently available; otherwise alerts, else incidents (the previous fixed default). */
function resolveActiveTab(
  stored: string,
  {
    canViewAlerts,
    canViewIncidents,
    canViewOnCall,
  }: { canViewAlerts: boolean; canViewIncidents: boolean; canViewOnCall: boolean }
): TabId {
  const available: TabId[] = [
    ...(canViewAlerts ? [ALERTS_TAB_ID] : []),
    ...(canViewIncidents ? [INCIDENTS_TAB_ID] : []),
    ...(canViewOnCall ? [ON_CALL_TAB_ID] : []),
  ];
  return available.find((id) => id === stored) ?? (canViewAlerts ? ALERTS_TAB_ID : INCIDENTS_TAB_ID);
}

export function AlertIncidentTabs({
  alertsData,
  incidentsData,
  alertsFilter,
  onAlertsFilterChange,
  incidentsFilter,
  onIncidentsFilterChange,
  switchRef,
}: {
  alertsData: FiringAlertsData;
  incidentsData: IncidentsData;
  alertsFilter: FilterSelection;
  onAlertsFilterChange: (filter: FilterSelection) => void;
  incidentsFilter: FilterSelection;
  onIncidentsFilterChange: (filter: FilterSelection) => void;
  switchRef?: Ref<AlertIncidentSwitchHandle>;
}) {
  const canViewIncidents = !!incidentsData.enabled;
  const canViewAlerts = alertsData.enabled;

  const [storedTab, setActiveTab] = useStoredString(ALERTS_INCIDENTS_TAB_STORAGE_KEY, '');
  // Keyed on the stored value, not `activeTab`: whether this tab is available comes from the hook itself. When
  // the plugin is absent the hook has no teams to load anyway, so the two conditions select the same requests.
  // The IRM probe is memoized per plugin id, so this second usePluginBridge(Irm) costs no request.
  const onCallData = useOnCallSchedules({ skip: storedTab !== ON_CALL_TAB_ID });
  const canViewOnCall = !!onCallData.enabled;
  const activeTab = resolveActiveTab(storedTab, { canViewAlerts, canViewIncidents, canViewOnCall });
  const { count, hasAlerts, hasTeams, teamsLoading, loading, canCreate, newRuleHref, viewAllHref, error } = alertsData;
  const {
    loading: incidentsLoading,
    error: incidentsError,
    count: incidentsCount,
    hasMore: incidentsHasMore,
    pluginId: incidentsPluginId,
    canDeclare: incidentsCanDeclare,
    canAccess: incidentsCanAccess,
  } = incidentsData;
  // Kept here rather than in the dropdown, which only renders for the active tab.
  // The alerts dropdown waits for teams: until then it's unknown whether its default is "Your teams".
  const loadAlertOptions = useAlertFilterOptions(canViewAlerts && !teamsLoading);
  const loadIncidentOptions = useIncidentFilterOptions(canViewIncidents);

  const isAlertActionsVisible = canViewAlerts && !loading && !error && activeTab === ALERTS_TAB_ID;
  const isIncidentsActionsVisible =
    canViewIncidents && !incidentsLoading && !incidentsError && activeTab === INCIDENTS_TAB_ID;
  const isOnCallActionsVisible =
    canViewOnCall && !onCallData.loading && !onCallData.error && onCallData.canAccess && activeTab === ON_CALL_TAB_ID;

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
    [setActiveTab]
  );

  // Hide the tabs if none of alerts, incidents, or OnCall schedules are available
  if (!canViewAlerts && !canViewIncidents && !canViewOnCall) {
    return null;
  }

  const title =
    canViewAlerts && canViewIncidents
      ? t('home.alerts-incidents.title', 'Alerts & incidents')
      : canViewIncidents
        ? t('home.alerts-incidents.title-incidents', 'Incidents')
        : t('home.alerts-incidents.title-alerts', 'Alerts');

  // Each tab keeps its own selection: alerts filter by any alert rule label, incidents by any
  // incident label, so a shared pick would often name a value the other tab can't hold.
  const tabs = [
    ...(canViewAlerts
      ? [
          {
            id: ALERTS_TAB_ID,
            label: t('home.alerts-incidents.alert-tab-label', 'Firing alerts'),
            // Undefined while loading so the counter doesn't flash 0 before the alerts arrive.
            counter: loading ? undefined : count,
            filter: loadAlertOptions && {
              loadOptions: loadAlertOptions,
              selected: alertsFilter,
              onChange: onAlertsFilterChange,
              offersYourTeams: hasTeams,
              allOptionLabel: t('home.alerts-incidents.alert-filter-all', 'All alerts'),
              ariaLabel: t('home.alerts-incidents.alert-filter-label', 'Filter alerts by label'),
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
            filter: loadIncidentOptions && {
              loadOptions: loadIncidentOptions,
              selected: incidentsFilter,
              onChange: onIncidentsFilterChange,
              // Incidents have no "your teams" scope: the unfiltered default is every active incident.
              offersYourTeams: false,
              allOptionLabel: t('home.alerts-incidents.incident-filter-all', 'All incidents'),
              ariaLabel: t('home.alerts-incidents.incident-filter-label', 'Filter incidents by label'),
            },
          },
        ]
      : []),
    ...(canViewOnCall
      ? [{ id: ON_CALL_TAB_ID, label: t('home.alerts-incidents.on-call-tab-label', 'On call schedules') }]
      : []),
  ];
  const filter = tabs.find((tab) => tab.id === activeTab)?.filter;

  return (
    <Stack direction="column" gap={1} minWidth={0} ref={containerRef}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          {title}
        </Text>
        {onCallData.isOnCall && <Badge text={t('home.alerts-incidents.on-call-now', 'On call now')} color="green" />}
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
            {filter && (
              <Box paddingTop={2}>
                <LabelFilterCombobox {...filter} />
              </Box>
            )}
            <ScrollContainer showScrollIndicators>
              {activeTab === ALERTS_TAB_ID && <FiringAlertsCard data={alertsData} hideFooterActions />}
              {activeTab === INCIDENTS_TAB_ID && <IncidentsCard data={incidentsData} hideFooterActions />}
              {activeTab === ON_CALL_TAB_ID && <OnCallCard data={onCallData} />}
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

            {/* On call tab footer */}
            {isOnCallActionsVisible && (
              <FooterActions>
                <FooterAction
                  href={onCallData.schedulesHref}
                  onClick={() => ctaClicked({ surface: 'oncall_card', action: 'view_schedules', placement: 'footer' })}
                >
                  <Trans i18nKey="home.alerts-incidents.view-schedules">View schedules</Trans>
                </FooterAction>
              </FooterActions>
            )}
          </Box>
        </TabContent>
      </HomeSection>
    </Stack>
  );
}

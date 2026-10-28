import { type ComponentProps, type ReactNode, useImperativeHandle, useRef, type Ref } from 'react';

import { isTruthy } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';

import { DASHBOARD_TABS_SCROLL_HEIGHT } from '../DashboardTabs/types';
import { CardFooter } from '../FooterActions';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { FiringAlertsCard } from './FiringAlertsCard';
import { IncidentsCard } from './IncidentsCard';
import { LabelFilterCombobox } from './LabelFilterCombobox';
import { OnCallCard, ViewSchedulesAction } from './OnCallCard';
import { ViewAllAlertsAction } from './ViewAllAlertsAction';
import { ViewAllIncidentsAction } from './ViewAllIncidentsAction';
import { type FilterSelection } from './filterSelection';
import { useAlertFilterOptions } from './useAlertFilterOptions';
import { type FiringAlertsData } from './useFiringAlerts';
import { useIncidentFilterOptions } from './useIncidentFilterOptions';
import { type IncidentsData } from './useIncidents';
import { useMyShifts } from './useOnCallSchedules';

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

interface TabDefinition {
  id: TabId;
  label: string;
  // Undefined while loading so the counter doesn't flash 0 before the data arrives.
  counter?: number;
  counterCappedAt?: number;
  // Sits at the footer's left; stays through loading and errors so the scope can still be changed.
  filter?: ComponentProps<typeof LabelFilterCombobox>;
  content: ReactNode;
  // The footer's right-hand action. Each tab gates this on its own data state; false renders nothing.
  footer: ReactNode;
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
  const onCall = useMyShifts();
  const { count, hasAlerts, hasTeams, teamsLoading, loading, viewAllHref, error } = alertsData;
  const {
    loading: incidentsLoading,
    error: incidentsError,
    count: incidentsCount,
    hasMore: incidentsHasMore,
    pluginId: incidentsPluginId,
    canAccess: incidentsCanAccess,
  } = incidentsData;
  // Kept here rather than in the dropdown, which only renders for the active tab.
  // The alerts dropdown waits for teams: until then it's unknown whether its default is "Your teams".
  const loadAlertOptions = useAlertFilterOptions(canViewAlerts && !teamsLoading);
  const loadIncidentOptions = useIncidentFilterOptions(canViewIncidents);

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

  // An IRM tab whose availability is still unknown (plugin probe in flight) stays on offer while it is the
  // remembered one, so a reload doesn't paint another tab first; it drops out if the probe says no.
  const isOffered = (id: TabId, enabled: boolean | undefined) => enabled ?? id === storedTab;

  // Each tab keeps its own selection: alerts filter by any alert rule label, incidents by any
  // incident label, so a shared pick would often name a value the other tab can't hold.
  const tabs: TabDefinition[] = [
    canViewAlerts && {
      id: ALERTS_TAB_ID,
      label: t('home.alerts-incidents.alert-tab-label', 'Firing alerts'),
      counter: loading ? undefined : count,
      filter: loadAlertOptions && {
        loadOptions: loadAlertOptions,
        selected: alertsFilter,
        onChange: onAlertsFilterChange,
        offersYourTeams: hasTeams,
        allOptionLabel: t('home.alerts-incidents.alert-filter-all', 'All alerts'),
        ariaLabel: t('home.alerts-incidents.alert-filter-label', 'Filter alerts by label'),
      },
      content: <FiringAlertsCard data={alertsData} />,
      footer: !loading && !error && <ViewAllAlertsAction hasAlerts={hasAlerts} viewAllHref={viewAllHref} />,
    },
    isOffered(INCIDENTS_TAB_ID, incidentsData.enabled) && {
      id: INCIDENTS_TAB_ID,
      label: t('home.alerts-incidents.incident-tab-label', 'Incidents'),
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
      content: <IncidentsCard data={incidentsData} />,
      footer: !incidentsLoading && !incidentsError && (
        <ViewAllIncidentsAction pluginId={incidentsPluginId} canAccess={incidentsCanAccess} />
      ),
    },
    isOffered(ON_CALL_TAB_ID, onCall.enabled) && {
      id: ON_CALL_TAB_ID,
      label: t('home.alerts-incidents.on-call-tab-label', 'My on-call schedules'),
      // Shares the header's clock, so a shift boundary flips badge and row in the same render.
      content: <OnCallCard now={onCall.now} />,
      // A static link to the plugin page: it needs no load state, only the page access check.
      footer: onCall.canAccess && <ViewSchedulesAction href={onCall.schedulesHref} />,
    },
  ].filter(isTruthy);

  if (tabs.length === 0) {
    return null;
  }
  // The remembered tab while it is on offer; otherwise the first one (alerts before incidents).
  const activeTab = tabs.find((tab) => tab.id === storedTab) ?? tabs[0];

  const title =
    canViewAlerts && canViewIncidents
      ? t('home.alerts-incidents.title', 'Alerts & incidents')
      : canViewIncidents
        ? t('home.alerts-incidents.title-incidents', 'Incidents')
        : t('home.alerts-incidents.title-alerts', 'Alerts');

  return (
    <Stack direction="column" gap={1} minWidth={0} ref={containerRef}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          {title}
        </Text>
        {onCall.isOnCall && <Badge text={t('home.alerts-incidents.on-call-now', 'On call now')} color="green" />}
      </Stack>

      <HomeSection paddingX={2} paddingY={1} display="flex" direction="column" grow={1}>
        <TabsBar>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tabElementId(tab.id)}
              aria-controls={PANEL_ID}
              label={tab.label}
              active={activeTab.id === tab.id}
              counter={tab.counter}
              onChangeTab={() => {
                setActiveTab(tab.id);
                tabChanged({ tab: tab.id });
              }}
              counterCappedAt={tab.counterCappedAt}
            />
          ))}
        </TabsBar>
        <TabContent id={PANEL_ID} role="tabpanel" aria-labelledby={tabElementId(activeTab.id)}>
          {/* Fixed list height and a footer of one height, so switching tabs or loading never moves the card. */}
          <Box display="flex" direction="column" height={`${DASHBOARD_TABS_SCROLL_HEIGHT}px`}>
            <ScrollContainer showScrollIndicators>{activeTab.content}</ScrollContainer>
          </Box>

          <Box padding={1} paddingTop={1.5}>
            <CardFooter filter={activeTab.filter && <LabelFilterCombobox {...activeTab.filter} />}>
              {activeTab.footer}
            </CardFooter>
          </Box>
        </TabContent>
      </HomeSection>
    </Stack>
  );
}

import { Suspense, useEffect, useRef } from 'react';

import { OrgRole, PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { useStoredString } from 'app/core/hooks/useStored';
import { contextSrv } from 'app/core/services/context_srv';

import { AlertIncidentTabs, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import { ALERTS_FILTER_STORAGE_KEY, INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/filterSelection';
import { useFiringAlerts } from './AlertsIncidents/useFiringAlerts';
import { useIncidents } from './AlertsIncidents/useIncidents';
import { AssistantInputSlot } from './AssistantInputSlot';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { HeaderActions } from './HeaderActions';
import { HomeGrid } from './HomeGrid';
import { HomePageFrame } from './HomePageFrame';
import { Overview } from './Overview/Overview';
import { Recommendations } from './Recommendations/Recommendations';
import { homepageViewed } from './analytics/main';
import { useHomepageSolutions } from './useHomepageSolutions';

/**
 * Each section owns its loading state, so the shell paints at once. The setup-guide sections come last: arriving
 * late moves nothing above them.
 */
export default function HomePage() {
  const solutions = useHomepageSolutions();
  // Onboarding for org members; anonymous or no-org users can't act on it, so skip the sections and their probes.
  const showSolutions = contextSrv.isSignedIn && contextSrv.user.orgRole !== OrgRole.None;

  const { components: extraComponents } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

  // Persisted filter scopes, one per view; each also drives that view's header pill.
  const [alertsFilter, setAlertsFilter] = useStoredString(ALERTS_FILTER_STORAGE_KEY, '');
  const [incidentsFilter, setIncidentsFilter] = useStoredString(INCIDENTS_FILTER_STORAGE_KEY, '');
  const alertsData = useFiringAlerts(alertsFilter);
  const incidentsData = useIncidents(incidentsFilter);
  const alertIncidentRef = useRef<AlertIncidentSwitchHandle | null>(null);

  // Once per mount, StrictMode replays included. HomeRoute mounts this only when the unified homepage renders.
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      homepageViewed();
    }
  }, []);

  return (
    <HomePageFrame
      actions={
        <HeaderActions alertsData={alertsData} incidentsData={incidentsData} alertIncidentRef={alertIncidentRef} />
      }
    >
      <Stack direction="column" gap={2}>
        <AssistantInputSlot />

        <HomeGrid columns={2} gap={2}>
          <DashboardTabs />
          <AlertIncidentTabs
            alertsData={alertsData}
            incidentsData={incidentsData}
            alertsFilter={alertsFilter}
            onAlertsFilterChange={setAlertsFilter}
            incidentsFilter={incidentsFilter}
            onIncidentsFilterChange={setIncidentsFilter}
            switchRef={alertIncidentRef}
          />
        </HomeGrid>

        {showSolutions && (
          <>
            <Recommendations solutions={solutions} />
            <Overview solutions={solutions.solutions} />
          </>
        )}

        {/* SetupGuide injects assorted sections for Cloud users. */}
        <Suspense fallback={null}>
          {renderLimitedComponents({ props: {}, components: extraComponents, pluginId: SETUPGUIDE_PLUGIN_ID })}
        </Suspense>
      </Stack>
    </HomePageFrame>
  );
}

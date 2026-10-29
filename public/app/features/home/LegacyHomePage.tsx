import { Suspense, useCallback, useEffect, useRef } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { ASSISTANT_PLUGIN_ID, SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { useStoredString } from 'app/core/hooks/useStored';

import { FiringAlertsCard } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { NewsCard } from './AlertsIncidents/NewsCard';
import { ALERTS_FILTER_STORAGE_KEY, INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/filterSelection';
import { useFiringAlerts } from './AlertsIncidents/useFiringAlerts';
import { useIncidents } from './AlertsIncidents/useIncidents';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HomeGrid } from './HomeGrid';
import { HomePageFrame } from './HomePageFrame';
import { HomeSection } from './HomeSection';
import { LegacyHomePageSkeleton } from './LegacyHomePageSkeleton';
import { PluginSectionFrame } from './PluginSectionFrame';
import { homepageViewed } from './analytics/main';

/** Reports a view on mount; inside a Suspense boundary React defers the effect until the content is revealed. */
function HomepageViewTracker({ onView }: { onView: () => void }) {
  useEffect(() => {
    onView();
  }, [onView]);

  return null;
}

/**
 * The legacy layout reveals as one: its skeleton stands in until every extension has loaded, and a lazy
 * extension suspends into the same skeleton rather than the route-level spinner.
 */
export function LegacyHomePage() {
  const { components: assistantComponents, isLoading: isLoadingAssistant } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageAssistant,
  });
  const { components: extraComponents, isLoading: isLoadingExtra } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });
  const { components: tabComponents, isLoading: isLoadingTabs } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  // The stored filter scopes each card's query; only the redesign's header pills can change it.
  const [alertsFilter] = useStoredString(ALERTS_FILTER_STORAGE_KEY, '');
  const [incidentsFilter] = useStoredString(INCIDENTS_FILTER_STORAGE_KEY, '');
  const alertsData = useFiringAlerts(alertsFilter);
  const incidentsData = useIncidents(incidentsFilter);

  // Counts a rendered homepage, never the skeleton: the tracker mounts inside the Suspense boundary, so a suspended
  // extension defers it until reveal. The ref keeps it once per mount across boundary remounts and StrictMode
  // replays. HomeRoute mounts this only when the unified homepage renders.
  const hasTrackedView = useRef(false);
  const trackView = useCallback(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      homepageViewed();
    }
  }, []);

  // SetupGuide injects assorted sections for Cloud users. Computed once so showExtra matches
  // what actually renders below.
  const extraContent = renderLimitedComponents({
    props: {},
    components: extraComponents,
    pluginId: SETUPGUIDE_PLUGIN_ID,
    wrapper: PluginSectionFrame,
  });

  const isLoadingExtensions =
    isLoadingAssistant || isLoadingExtra || isLoadingTabs || incidentsData.enabled === undefined;
  const skeleton = (
    <LegacyHomePageSkeleton
      showAlertsCard={alertsData.enabled}
      showIRMNewsCard={incidentsData.enabled === undefined || incidentsData.enabled || config.newsFeedEnabled}
      showExtra={extraContent !== null}
    />
  );

  return (
    <HomePageFrame>
      {isLoadingExtensions ? (
        skeleton
      ) : (
        <Suspense fallback={skeleton}>
          <HomepageViewTracker onView={trackView} />
          <Stack direction="column" gap={2}>
            <HomeSection direction="column" display="flex" gap={2}>
              {/* Assistant injects an Assistant-based prompt input when available */}
              {renderLimitedComponents({
                props: {},
                limit: 1,
                components: assistantComponents,
                pluginId: ASSISTANT_PLUGIN_ID,
              })}
              <DashboardTabs extensionComponents={tabComponents} />
            </HomeSection>

            <HomeGrid columns={2} gap={2}>
              {alertsData.enabled && <FiringAlertsCard data={alertsData} />}
              {incidentsData.enabled ? <IncidentsCard data={incidentsData} /> : config.newsFeedEnabled && <NewsCard />}
            </HomeGrid>
            {extraContent}
          </Stack>
        </Suspense>
      )}
    </HomePageFrame>
  );
}

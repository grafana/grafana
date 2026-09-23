import { css } from '@emotion/css';
import { Suspense, useCallback, useEffect, useRef } from 'react';

import { OrgRole, PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ASSISTANT_PLUGIN_ID, SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { useStoredString } from 'app/core/hooks/useStored';
import { contextSrv } from 'app/core/services/context_srv';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { AlertIncidentTabs, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import { FiringAlertsCard } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { NewsCard } from './AlertsIncidents/NewsCard';
import { INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/incidentFilter';
import { ALERTS_TEAM_FILTER_STORAGE_KEY } from './AlertsIncidents/teamFilter';
import { useFiringAlerts } from './AlertsIncidents/useFiringAlerts';
import { useIncidents } from './AlertsIncidents/useIncidents';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HeaderActions } from './HeaderActions';
import { HomeGrid } from './HomeGrid';
import { HomePageSkeleton } from './HomePageSkeleton';
import { HomeSection } from './HomeSection';
import { Overview } from './Overview/Overview';
import { resolveOverviewCard } from './Overview/solutionGroups';
import { Recommendations } from './Recommendations/Recommendations';
import { homepageViewed } from './analytics/main';
import useHomeGreeting from './useHomeGreeting';
import { useHomepageSolutions } from './useHomepageSolutions';

const getEdition = () => {
  if (!isOnPrem()) {
    return t('home.home-page.edition.cloud', 'Grafana Cloud');
  }

  if (config.buildInfo.edition === GrafanaEdition.Enterprise) {
    return t('home.home-page.edition.enterprise', 'Grafana Enterprise');
  }

  return t('home.home-page.edition.open-source', 'Grafana');
};

/**
 * Renders nothing; reports a view on mount. Inside a Suspense boundary, React defers
 * the effect until the content is revealed.
 */
function HomepageViewTracker({ onView }: { onView: () => void }) {
  useEffect(() => {
    onView();
  }, [onView]);

  return null;
}

export default function HomePage() {
  const styles = useStyles2(getStyles);
  const greeting = useHomeGreeting();

  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const solutions = useHomepageSolutions();
  // Recommendations and the stack overview are onboarding for org members; anonymous or
  // no-org users can't act on any of it, so skip the sections and their placement probes.
  const showSolutions = contextSrv.isSignedIn && contextSrv.user.orgRole !== OrgRole.None;
  // Placement is the slow part of the page and needs nothing from the extensions gating the
  // sections: start it at mount so it runs under the skeleton. Its facts are memoized on the
  // solution or TTL-cached, so the overview's own placement re-reads settled promises when it mounts.
  useEffect(() => {
    if (redesignEnabled && showSolutions) {
      for (const solution of solutions.solutions) {
        void resolveOverviewCard(solution);
      }
    }
  }, [redesignEnabled, showSolutions, solutions]);

  const { components: assistantComponents, isLoading: isLoadingAssistant } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageAssistant,
  });

  const { components: extraComponents, isLoading: isLoadingExtra } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

  const { components: tabComponents, isLoading: isLoadingTabs } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  // Persisted filter scopes, one per view; each also drives that view's header pill.
  const [alertsTeam, setAlertsTeam] = useStoredString(ALERTS_TEAM_FILTER_STORAGE_KEY, '');
  const [incidentsFilter, setIncidentsFilter] = useStoredString(INCIDENTS_FILTER_STORAGE_KEY, '');
  const alertsData = useFiringAlerts(alertsTeam);
  const incidentsData = useIncidents(incidentsFilter);
  const alertIncidentRef = useRef<AlertIncidentSwitchHandle | null>(null);

  const isWaitingForTabs = !redesignEnabled && isLoadingTabs;
  const isWaitingForIRM = !redesignEnabled && incidentsData.enabled === undefined;
  const isLoadingExtensions = isLoadingAssistant || isLoadingExtra || isWaitingForTabs || isWaitingForIRM;

  // The impression counts a rendered homepage, never a skeleton: the tracker mounts inside
  // the Suspense boundary below, so a suspended lazy extension defers it until reveal. The
  // ref keeps it once per mount (extension loading can flip and remount the boundary's
  // children; StrictMode replays effects). HomeRoute only mounts HomePage when the unified
  // homepage actually renders (redirect / home-dashboard branches never reach here).
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
    wrapper: ({ children }) =>
      redesignEnabled ? (
        children
      ) : (
        <div className={styles.extra}>
          <HomeSection>{children}</HomeSection>
        </div>
      ),
  });
  const showExtra = extraContent !== null;
  const showAlertsCard = alertsData.enabled;
  const showIRMNewsCard = incidentsData.enabled === undefined || incidentsData.enabled || config.newsFeedEnabled;
  const skeleton = (
    <HomePageSkeleton
      showAlertsCard={showAlertsCard}
      showIRMNewsCard={showIRMNewsCard}
      showExtra={showExtra}
      showSolutions={showSolutions}
      redesignEnabled={redesignEnabled}
    />
  );

  return (
    <Page
      navId="home"
      pageNav={{
        text: greeting,
        subTitle: t('home.home-page.placeholder', 'Welcome to {{edition}}.', { edition: getEdition() }),
        hideFromBreadcrumbs: true,
      }}
      actions={
        redesignEnabled ? (
          <HeaderActions alertsData={alertsData} incidentsData={incidentsData} alertIncidentRef={alertIncidentRef} />
        ) : undefined
      }
      layout={PageLayoutType.Home}
    >
      <Page.Contents>
        {isLoadingExtensions ? (
          skeleton
        ) : (
          <Suspense fallback={skeleton}>
            <HomepageViewTracker onView={trackView} />
            <Stack direction="column" gap={2}>
              {redesignEnabled ? (
                <>
                  {renderLimitedComponents({
                    props: {},
                    limit: 1,
                    components: assistantComponents,
                    pluginId: ASSISTANT_PLUGIN_ID,
                    wrapper: ({ children }) => (
                      <div className={styles.extra}>
                        <HomeSection>{children}</HomeSection>
                      </div>
                    ),
                  })}

                  <HomeGrid columns={2} gap={2}>
                    {/* Skip the HomepageTabs extension point for the redesign UI */}
                    <DashboardTabs extensionComponents={[]} />
                    <AlertIncidentTabs
                      alertsData={alertsData}
                      incidentsData={incidentsData}
                      alertsTeam={alertsTeam}
                      onAlertsTeamChange={setAlertsTeam}
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
                </>
              ) : (
                <>
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
                    {incidentsData.enabled ? (
                      <IncidentsCard data={incidentsData} />
                    ) : (
                      config.newsFeedEnabled && <NewsCard />
                    )}
                  </HomeGrid>
                </>
              )}
              {extraContent}
            </Stack>
          </Suspense>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = () => ({
  extra: css({
    display: 'contents',

    '> div': {
      '&:empty': {
        display: 'none',
      },
    },
  }),
});

import { css } from '@emotion/css';
import { type ReactNode, Suspense, useCallback, useEffect, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type ComponentTypeWithExtensionMeta, OrgRole, PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { useAppPluginMeta, useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ASSISTANT_PLUGIN_ID, SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { useStoredString } from 'app/core/hooks/useStored';
import { contextSrv } from 'app/core/services/context_srv';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { AlertIncidentTabs, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import { FiringAlertsCard } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { NewsCard } from './AlertsIncidents/NewsCard';
import { ALERTS_FILTER_STORAGE_KEY, INCIDENTS_FILTER_STORAGE_KEY } from './AlertsIncidents/filterSelection';
import { useFiringAlerts } from './AlertsIncidents/useFiringAlerts';
import { useIncidents } from './AlertsIncidents/useIncidents';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HeaderActions } from './HeaderActions';
import { HomeGrid } from './HomeGrid';
import { HomePageSkeleton } from './HomePageSkeleton';
import { HomeSection } from './HomeSection';
import { Overview } from './Overview/Overview';
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

/** The Assistant's prompt input as the plugin renders it today; off by a few px at worst, not by the whole card. */
const ASSISTANT_INPUT_HEIGHT = 50;

/**
 * Frames a plugin-rendered section; the frame hides when the section renders nothing. Module-level so the
 * component type is stable across renders: an inline wrapper would remount the section on every render.
 */
function PluginSectionFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.extra}>
      <HomeSection>{children}</HomeSection>
    </div>
  );
}

/**
 * The Assistant's prompt input on the redesigned homepage. The plugin's presence is known before its component
 * is, so the slot keeps the input's height while the component loads and the sections below do not move when it
 * lands. Presence is assumed until the plugin metas answer: the redesign ships to Cloud, where the Assistant is
 * installed, so the slot only ever disappears on an instance without it. Then it renders nothing.
 */
function AssistantInput({
  components,
  loading,
}: {
  components: Array<ComponentTypeWithExtensionMeta<{}>>;
  loading: boolean;
}) {
  const meta = useAppPluginMeta(ASSISTANT_PLUGIN_ID);
  const placeholder = (
    <PluginSectionFrame>
      <Skeleton
        height={ASSISTANT_INPUT_HEIGHT}
        containerClassName={styles.block}
        containerTestId="home-page-assistant-skeleton"
      />
    </PluginSectionFrame>
  );
  if (loading) {
    return meta.loading || meta.value ? placeholder : null;
  }
  return (
    <Suspense fallback={placeholder}>
      {renderLimitedComponents({
        props: {},
        limit: 1,
        components,
        pluginId: ASSISTANT_PLUGIN_ID,
        wrapper: PluginSectionFrame,
      })}
    </Suspense>
  );
}

export default function HomePage() {
  const greeting = useHomeGreeting();

  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const solutions = useHomepageSolutions();
  // Recommendations and the stack overview are onboarding for org members; anonymous or
  // no-org users can't act on any of it, so skip the sections and their placement probes.
  const showSolutions = contextSrv.isSignedIn && contextSrv.user.orgRole !== OrgRole.None;

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
  const [alertsFilter, setAlertsFilter] = useStoredString(ALERTS_FILTER_STORAGE_KEY, '');
  const [incidentsFilter, setIncidentsFilter] = useStoredString(INCIDENTS_FILTER_STORAGE_KEY, '');
  const alertsData = useFiringAlerts(alertsFilter);
  const incidentsData = useIncidents(incidentsFilter);
  const alertIncidentRef = useRef<AlertIncidentSwitchHandle | null>(null);

  // The impression counts a rendered homepage, never a whole-page skeleton. The ref keeps it once per mount
  // (extension loading can flip and remount a Suspense boundary's children; StrictMode replays effects).
  // HomeRoute only mounts HomePage when the unified homepage actually renders (redirect / home-dashboard
  // branches never reach here).
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
    wrapper: redesignEnabled ? undefined : PluginSectionFrame,
  });

  // Every section owns its loading state, so the page shell paints at once and nothing waits for the plugin
  // extensions: the Assistant slot holds its height until its component lands, and the setup-guide sections
  // come last, so arriving late moves nothing above them.
  const redesign = (
    <Stack direction="column" gap={2}>
      <HomepageViewTracker onView={trackView} />
      <AssistantInput components={assistantComponents} loading={isLoadingAssistant} />

      <HomeGrid columns={2} gap={2}>
        {/* Skip the HomepageTabs extension point for the redesign UI */}
        <DashboardTabs extensionComponents={[]} />
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

      <Suspense fallback={null}>{extraContent}</Suspense>
    </Stack>
  );

  // The legacy layout reveals as one: its skeleton stands in until every extension has loaded, and a lazy
  // extension suspends into the same skeleton rather than the route-level spinner.
  const isLoadingLegacyExtensions =
    isLoadingAssistant || isLoadingExtra || isLoadingTabs || incidentsData.enabled === undefined;
  const legacySkeleton = (
    <HomePageSkeleton
      showAlertsCard={alertsData.enabled}
      showIRMNewsCard={incidentsData.enabled === undefined || incidentsData.enabled || config.newsFeedEnabled}
      showExtra={extraContent !== null}
    />
  );
  const legacy = isLoadingLegacyExtensions ? (
    legacySkeleton
  ) : (
    <Suspense fallback={legacySkeleton}>
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
      <Page.Contents>{redesignEnabled ? redesign : legacy}</Page.Contents>
    </Page>
  );
}

const styles = {
  extra: css({
    display: 'contents',

    '> div': {
      '&:empty': {
        display: 'none',
      },
    },
  }),
  block: css({
    display: 'block',
  }),
};

import { css, cx } from '@emotion/css';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Grid, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { FiringAlertsCard, canViewFiringAlerts } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HomePageSkeleton } from './HomePageSkeleton';
import { HomeSection } from './HomeSection';
import useHomeGreeting from './useHomeGreeting';

// Mounts (and runs its effect) only once the surrounding Suspense content has actually
// committed — i.e. after any lazy-loaded extension components have resolved and any
// extension tabs have registered (sibling effects flush before this one, in tree order).
// Known limitation: an extension that registers its tab from its own async work (not
// synchronously in a mount effect) settles after the reveal and still pops in.
function SettleSentinel({ onSettled }: { onSettled: () => void }) {
  useEffect(onSettled, [onSettled]);
  return null;
}

const getEdition = () => {
  if (!isOnPrem()) {
    return t('home.home-page.edition.cloud', 'Grafana Cloud');
  }

  if (config.buildInfo.edition === GrafanaEdition.Enterprise) {
    return t('home.home-page.edition.enterprise', 'Grafana Enterprise');
  }

  return t('home.home-page.edition.open-source', 'Grafana');
};

export default function HomePage() {
  const styles = useStyles2(getStyles);
  const greeting = useHomeGreeting();

  const { components: preComponents, isLoading: isLoadingPre } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepagePre,
  });

  const { components: extraComponents, isLoading: isLoadingExtra } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

  const { components: tabComponents, isLoading: isLoadingTabs } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  const isLoadingExtensions = isLoadingPre || isLoadingExtra || isLoadingTabs;

  // Same computation as the rendered extra section below, so showExtra can't drift from it.
  const extraContent = renderLimitedComponents({
    props: {},
    components: extraComponents,
    pluginId: SETUPGUIDE_PLUGIN_ID,
    wrapper: ({ children }) => (
      <div className={styles.extra}>
        <HomeSection>{children}</HomeSection>
      </div>
    ),
  });
  const showExtra = extraContent !== null;
  const showAlertsCard = canViewFiringAlerts();

  // The content is revealed only once it has fully committed (see SettleSentinel) AND the
  // initial dashboard fetches have settled. Until then it renders hidden behind the skeleton,
  // so lazy extension components, extension tab registration, and the DashboardTabs auto-switch
  // never paint as a separate step.
  const [extensionsSettled, setExtensionsSettled] = useState(false);
  const [dashboardsSettled, setDashboardsSettled] = useState(false);
  const onExtensionsSettled = useCallback(() => setExtensionsSettled(true), []);
  const onDashboardsSettled = useCallback(() => setDashboardsSettled(true), []);
  const settled = extensionsSettled && dashboardsSettled;

  return (
    <Page
      navId="home"
      pageNav={{
        text: greeting,
        subTitle: t('home.home-page.placeholder', 'Welcome to {{edition}}.', { edition: getEdition() }),
        hideFromBreadcrumbs: true,
      }}
      layout={PageLayoutType.Home}
    >
      <Page.Contents>
        {isLoadingExtensions ? (
          <HomePageSkeleton showAlertsCard={showAlertsCard} showExtra={showExtra} />
        ) : (
          <div className={styles.content}>
            {!settled && (
              <div className={styles.skeletonOverlay}>
                <HomePageSkeleton showAlertsCard={showAlertsCard} showExtra={showExtra} />
              </div>
            )}
            <div className={cx(!settled && styles.hiddenUntilSettled)}>
              {/* Local boundary: lazy-loaded extension components suspend here (keeping the
                  skeleton up) instead of bubbling to the route-level Suspense, which would
                  unmount the whole page */}
              <Suspense fallback={null}>
                <Stack direction="column" gap={2}>
                  <HomeSection direction="column" display="flex" gap={2}>
                    {renderLimitedComponents({
                      props: {},
                      components: preComponents,
                      pluginId: SETUPGUIDE_PLUGIN_ID,
                    })}
                    <DashboardTabs extensionComponents={tabComponents} onInitialLoad={onDashboardsSettled} />
                  </HomeSection>
                  <Grid gap={2} columns={{ xs: 1, md: 2 }}>
                    <FiringAlertsCard />
                    <IncidentsCard />
                  </Grid>

                  {extraContent}
                </Stack>
                <SettleSentinel onSettled={onExtensionsSettled} />
              </Suspense>
            </div>
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = () => ({
  content: css({
    position: 'relative',
  }),
  skeletonOverlay: css({
    position: 'absolute',
    inset: 0,
  }),
  // visibility (not display) keeps layout, so contents measure real dimensions
  // during the settle commit
  hiddenUntilSettled: css({
    visibility: 'hidden',
  }),
  extra: css({
    display: 'contents',

    '> div': {
      '&:empty': {
        display: 'none',
      },
    },
  }),
});

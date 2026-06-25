import { css } from '@emotion/css';
import { Suspense } from 'react';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Grid, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ASSISTANT_PLUGIN_ID, SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { FiringAlertsCard, canViewFiringAlerts } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HomePageSkeleton } from './HomePageSkeleton';
import { HomeSection } from './HomeSection';
import useHomeGreeting from './useHomeGreeting';

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

  const { components: assistantComponents, isLoading: isLoadingAssistant } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageAssistant,
  });

  const { components: extraComponents, isLoading: isLoadingExtra } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

  const { components: tabComponents, isLoading: isLoadingTabs } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  const isLoadingExtensions = isLoadingAssistant || isLoadingExtra || isLoadingTabs;
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
          <Suspense fallback={<HomePageSkeleton showAlertsCard={showAlertsCard} showExtra={showExtra} />}>
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
              <Grid gap={2} columns={{ xs: 1, md: 2 }}>
                <FiringAlertsCard />
                <IncidentsCard />
              </Grid>

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

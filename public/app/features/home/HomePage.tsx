import { css } from '@emotion/css';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { FiringAlertsCard } from './AlertsIncidents/FiringAlertsCard';
import { IncidentsCard } from './AlertsIncidents/IncidentsCard';
import { DashboardTabs } from './DashboardTabs/DashboardTabs';
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

  const { components: preComponents } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepagePre,
  });

  const { components: extraComponents } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

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
        <Stack direction="column" gap={2}>
          <HomeSection direction="column" display="flex" gap={2}>
            {renderLimitedComponents({
              props: {},
              components: preComponents,
              pluginId: SETUPGUIDE_PLUGIN_ID,
            })}
            <DashboardTabs />
          </HomeSection>
          <Stack direction="row" gap={2}>
            <div className={styles.card}>
              <FiringAlertsCard />
            </div>
            <div className={styles.card}>
              <IncidentsCard />
            </div>
          </Stack>

          {renderLimitedComponents({
            props: {},
            components: extraComponents,
            pluginId: SETUPGUIDE_PLUGIN_ID,
            wrapper: ({ children }) => (
              <div className={styles.extra}>
                <HomeSection>{children}</HomeSection>
              </div>
            ),
          })}
        </Stack>
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
  card: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minWidth: 0,
    // A card renders null when unavailable (no alerting permission / no incident plugin);
    // its empty wrapper then collapses so the remaining card spans the full row.
    '&:empty': {
      display: 'none',
    },
    // Stretch the card body to fill the row height so both cards stay equal height.
    '> *': {
      flex: 1,
    },
  }),
});

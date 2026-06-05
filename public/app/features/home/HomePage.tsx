import { css } from '@emotion/css';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Box, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { DashboardTabs } from './DashboardTabs/DashboardTabs';
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

  const { components: preComponents, isLoading: preLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepagePre,
  });

  const { components: extraComponents, isLoading: extraLoading } = usePluginComponents({
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
      <Page.Contents isLoading={preLoading || extraLoading}>
        <Stack direction="column" gap={2}>
          <Box backgroundColor="canvas" borderRadius="default" padding={4} direction="column" display="flex" gap={2}>
            {renderLimitedComponents({
              props: {},
              components: preComponents,
              pluginId: SETUPGUIDE_PLUGIN_ID,
            })}
            <DashboardTabs />
          </Box>

          {renderLimitedComponents({
            props: {},
            components: extraComponents,
            pluginId: SETUPGUIDE_PLUGIN_ID,
            wrapper: ({ children }) => (
              <div className={styles.extra}>
                <Box backgroundColor="canvas" borderRadius="default" padding={4}>
                  {children}
                </Box>
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
});

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Box, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
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
          <Box backgroundColor="canvas" borderRadius="default" padding={4} direction="column" display="flex" gap={2}>
            {renderLimitedComponents({
              props: {},
              components: preComponents,
              pluginId: 'grafana-setupguide-app',
            })}
            <DashboardTabs />
          </Box>

          {renderLimitedComponents({
            props: {},
            components: extraComponents,
            pluginId: 'grafana-setupguide-app',
            wrapper: ({ children }) =>
              children && (
                <Box backgroundColor="canvas" borderRadius="default" padding={4}>
                  {children}
                </Box>
              ),
          })}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

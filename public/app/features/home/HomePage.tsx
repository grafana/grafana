import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Box, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { DashboardTabs } from './DashboardTabs/DashboardTabs';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HomePageSkeleton } from './HomePageSkeleton';
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

  // Reveal one effect-flush after extensions finish loading: this gives extension
  // tabs a chance to register() before the first visible paint, so the page and
  // extension tabs appear together instead of the tabs popping in.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!isLoadingExtensions) {
      setSettled(true);
    }
  }, [isLoadingExtensions]);

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
          <HomePageSkeleton />
        ) : (
          <div className={styles.content}>
            {!settled && (
              <div className={styles.skeletonOverlay}>
                <HomePageSkeleton />
              </div>
            )}
            <div className={cx(!settled && styles.hiddenUntilSettled)}>
              <Stack direction="column" gap={2}>
                <Box
                  backgroundColor="canvas"
                  borderRadius="default"
                  padding={4}
                  direction="column"
                  display="flex"
                  gap={2}
                >
                  {renderLimitedComponents({
                    props: {},
                    components: preComponents,
                    pluginId: SETUPGUIDE_PLUGIN_ID,
                  })}
                  <DashboardTabs extensionComponents={tabComponents} />
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

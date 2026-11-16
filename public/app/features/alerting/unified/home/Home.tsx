import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useSlowQuery } from '../hooks/useSlowQuery';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import IRMCard from './IRMCard';
import { getInsightsScenes, isInsightsAvailable, useInsightsDataSources } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import SyntheticMonitoringCard from './SyntheticMonitoringCard';

// Loads faster than this show nothing, so a cached data source lookup does not flash a loading indicator.
const LOADING_INDICATOR_DELAY_MS = 300;

type HomeTab = 'insights' | 'overview';

function Home() {
  const styles = useStyles2(getStyles);
  const { isLoading, dataSources } = useInsightsDataSources();
  const isSlow = useSlowQuery(isLoading, { threshold: LOADING_INDICATOR_DELAY_MS });
  const insightsEnabled = isInsightsAvailable(dataSources) || isLocalDevEnv();

  const [selectedTab, setSelectedTab] = useState<HomeTab>();
  const activeTab: HomeTab = selectedTab ?? (insightsEnabled ? 'insights' : 'overview');
  const insightsScene = useMemo(
    () => (isLoading ? undefined : getInsightsScenes(dataSources)),
    [isLoading, dataSources]
  );

  return (
    <AlertingPageWrapper subTitle="Learn about problems in your systems moments after they occur" navId="alerting">
      <Stack gap={2} direction="column">
        <WelcomeHeader />
        <PluginIntegrations />
        {/* both ad cards hide themselves on licensed builds and once dismissed, so collapse the row when it ends up empty */}
        <div className={styles.adCards}>
          <SyntheticMonitoringCard />
          <IRMCard />
        </div>
      </Stack>
      {isLoading ? (
        isSlow && <HomeTabsSkeleton />
      ) : (
        <Box marginTop={2}>
          <TabsBar>
            {insightsEnabled && (
              <Tab
                key="insights"
                label={t('alerting.home.label-insights', 'Insights')}
                active={activeTab === 'insights'}
                onChangeTab={() => setSelectedTab('insights')}
              />
            )}
            <Tab
              key="overview"
              label={t('alerting.home.label-get-started', 'Get started')}
              active={activeTab === 'overview'}
              onChangeTab={() => setSelectedTab('overview')}
            />
          </TabsBar>
          <TabContent className={styles.tabContent}>
            {activeTab === 'insights' && insightsScene && <insightsScene.Component model={insightsScene} />}
            {activeTab === 'overview' && <GettingStarted />}
          </TabContent>
        </Box>
      )}
    </AlertingPageWrapper>
  );
}

function HomeTabsSkeleton() {
  return (
    <Box marginTop={2} data-testid="alerting-home-tabs-skeleton">
      <Skeleton width={240} height={32} />
      <Skeleton height={300} />
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  adCards: css({
    display: 'flex',
    gap: theme.spacing(2),

    '&:empty': {
      display: 'none',
    },
  }),
  tabContent: css({
    marginTop: theme.spacing(2),
  }),
});

export default withPageErrorBoundary(Home);

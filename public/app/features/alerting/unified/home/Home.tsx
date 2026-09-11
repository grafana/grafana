import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, LoadingPlaceholder, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import IRMCard from './IRMCard';
import { getInsightsScenes, insightsIsAvailable } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import SyntheticMonitoringCard from './SyntheticMonitoringCard';

type HomeTab = 'insights' | 'overview';

function Home() {
  const styles = useStyles2(getStyles);
  const { value: insights, loading } = useAsync(async () => {
    const enabled = (await insightsIsAvailable()) || isLocalDevEnv();
    return { enabled, scene: await getInsightsScenes() };
  }, []);

  // Availability is only known after the async check, so the default tab cannot be useState's initial value.
  const [selectedTab, setSelectedTab] = useState<HomeTab>();
  const activeTab = selectedTab ?? (insights?.enabled ? 'insights' : 'overview');

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
      <Box marginTop={2}>
        {loading ? (
          <LoadingPlaceholder text={t('alerting.home.text-loading', 'Loading...')} />
        ) : (
          <>
            <TabsBar>
              {insights?.enabled && (
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
              {activeTab === 'insights' && insights && <insights.scene.Component model={insights.scene} />}
              {activeTab === 'overview' && <GettingStarted />}
            </TabContent>
          </>
        )}
      </Box>
    </AlertingPageWrapper>
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

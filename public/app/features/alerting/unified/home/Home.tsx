import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import IRMCard from './IRMCard';
import { getInsightsScenes, insightsIsAvailable } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import SyntheticMonitoringCard from './SyntheticMonitoringCard';

function Home() {
  const styles = useStyles2(getStyles);
  const insightsEnabled = insightsIsAvailable() || isLocalDevEnv();

  const [activeTab, setActiveTab] = useState<'insights' | 'overview'>(insightsEnabled ? 'insights' : 'overview');
  const insightsScene = getInsightsScenes();

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
        <TabsBar>
          {insightsEnabled && (
            <Tab
              key="insights"
              label={t('alerting.home.label-insights', 'Insights')}
              active={activeTab === 'insights'}
              onChangeTab={() => setActiveTab('insights')}
            />
          )}
          <Tab
            key="overview"
            label={t('alerting.home.label-get-started', 'Get started')}
            active={activeTab === 'overview'}
            onChangeTab={() => setActiveTab('overview')}
          />
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {activeTab === 'insights' && <insightsScene.Component model={insightsScene} />}
          {activeTab === 'overview' && <GettingStarted />}
        </TabContent>
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

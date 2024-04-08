import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Box, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv, isOpenSourceEdition } from '../utils/misc';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import { getInsightsScenes } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';

export default function Home() {
  const styles = useStyles2(getStyles);

  const insightsEnabled =
    (!isOpenSourceEdition() || isLocalDevEnv()) && Boolean(config.featureToggles.alertingInsights);

  const [activeTab, setActiveTab] = useState<'insights' | 'overview'>(insightsEnabled ? 'insights' : 'overview');
  const insightsScene = getInsightsScenes();

  return (
    <AlertingPageWrapper
      title="Alerting"
      subTitle="Learn about problems in your systems moments after they occur"
      navId="alerting"
    >
      <Stack gap={2} direction="row" wrap="wrap">
        <Box flex="1 1 300px">
          <WelcomeHeader />
          <TabsBar>
            {insightsEnabled && (
              <Tab
                key="insights"
                label="Insights"
                active={activeTab === 'insights'}
                onChangeTab={() => setActiveTab('insights')}
              />
            )}
            <Tab
              key="overview"
              label="Get started"
              active={activeTab === 'overview'}
              onChangeTab={() => setActiveTab('overview')}
            />
          </TabsBar>
          <TabContent>
            {activeTab === 'insights' && <insightsScene.Component model={insightsScene} />}
            {activeTab === 'overview' && <GettingStarted />}
          </TabContent>
        </Box>
        <div className={styles.plugins}>
          <PluginIntegrations />
        </div>
      </Stack>
    </AlertingPageWrapper>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  plugins: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '0 1 300px',
    gap: theme.spacing(2),
    ':empty': { display: 'none' },
  }),
});

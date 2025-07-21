import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Box, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import IRMCard from './IRMCard';
import { getInsightsScenes, insightsIsAvailable } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import SyntheticMonitoringCard from './SyntheticMonitoringCard';

function Home() {
  const insightsEnabled = insightsIsAvailable() || isLocalDevEnv();

  const [activeTab, setActiveTab] = useState<'insights' | 'overview'>(insightsEnabled ? 'insights' : 'overview');
  const insightsScene = getInsightsScenes();

  return (
    <AlertingPageWrapper
      title={t('alerting.home.title-alerting', 'Alerting')}
      subTitle="Learn about problems in your systems moments after they occur"
      navId="alerting"
    >
      <Stack gap={2} direction="column">
        <WelcomeHeader />
        <PluginIntegrations />
      </Stack>
      <Box marginTop={{ lg: 2, md: 2, xs: 2 }}>
        <Stack direction="row" gap={2}>
          <SyntheticMonitoringCard />
          <IRMCard />
        </Stack>
      </Box>
      <Box marginTop={{ lg: 2, md: 0, xs: 0 }}>
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
        <TabContent>
          {activeTab === 'insights' && <insightsScene.Component model={insightsScene} />}
          {activeTab === 'overview' && <GettingStarted />}
        </TabContent>
      </Box>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(Home);

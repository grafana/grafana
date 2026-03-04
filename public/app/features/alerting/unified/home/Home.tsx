import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Box, Tab, TabContent, TabsBar } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { AdCardsStack } from './AdCardsStack';
import { assertsCardConfig } from './AssertsCard';
import GettingStarted from './GettingStarted';
import { irmCardConfig } from './IRMCard';
import { getInsightsScenes, insightsIsAvailable } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import { sloCardConfig } from './SLOCard';
import { syntheticMonitoringCardConfig } from './SyntheticMonitoringCard';

function Home() {
  const insightsEnabled = insightsIsAvailable() || isLocalDevEnv();

  const [activeTab, setActiveTab] = useState<'insights' | 'overview'>(insightsEnabled ? 'insights' : 'overview');
  const insightsScene = getInsightsScenes();

  return (
    <AlertingPageWrapper subTitle="Learn about problems in your systems moments after they occur" navId="alerting">
      <PluginIntegrations />
      <Box marginTop={{ lg: 2, md: 2, xs: 2 }}>
        <AdCardsStack cards={[syntheticMonitoringCardConfig, irmCardConfig, assertsCardConfig, sloCardConfig]} />
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

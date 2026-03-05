import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Stack, Tab, TabContent, TabsBar } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { AdCardsStack } from './AdCardsStack';
import { getAssertsCardConfig } from './AssertsCard';
import GettingStarted from './GettingStarted';
import { getIrmCardConfig } from './IRMCard';
import { getInsightsScenes, insightsIsAvailable } from './Insights';
import { PluginIntegrations } from './PluginIntegrations';
import { getSloCardConfig } from './SLOCard';
import { getSyntheticMonitoringCardConfig } from './SyntheticMonitoringCard';

function Home() {
  const insightsEnabled = insightsIsAvailable() || isLocalDevEnv();

  const [activeTab, setActiveTab] = useState<'insights' | 'overview'>(insightsEnabled ? 'insights' : 'overview');
  const insightsScene = getInsightsScenes();

  return (
    <AlertingPageWrapper subTitle="Learn about problems in your systems moments after they occur" navId="alerting">
      <PluginIntegrations />
      <AdCardsStack
        cards={[getSyntheticMonitoringCardConfig(), getIrmCardConfig(), getAssertsCardConfig(), getSloCardConfig()]}
      />
      <Stack direction="column" gap={2}>
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
      </Stack>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(Home);

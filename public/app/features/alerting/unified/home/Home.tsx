import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { Tab, TabContent, TabsBar } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import Insights from './Insights';

type HomeTabs = 'insights' | 'gettingStarted';

export default function Home() {
  const [activeTab, setActiveTab] = useState<HomeTabs>('insights');

  const alertingInsightsEnabled = config.featureToggles.alertingInsights;
  return (
    <AlertingPageWrapper pageId={'alerting'}>
      {alertingInsightsEnabled && (
        <>
          <WelcomeHeader />
          <TabsBar>
            <Tab
              key={'insights'}
              label={'Insights'}
              active={activeTab === 'insights'}
              onChangeTab={() => {
                setActiveTab('insights');
              }}
            />
            <Tab
              key={'gettingStarted'}
              label={'Overview'}
              active={activeTab === 'gettingStarted'}
              onChangeTab={() => {
                setActiveTab('gettingStarted');
              }}
            />
          </TabsBar>
          <TabContent>
            {activeTab === 'insights' && <Insights />}
            {activeTab === 'gettingStarted' && <GettingStarted />}
          </TabContent>
        </>
      )}

      {!alertingInsightsEnabled && <GettingStarted showWelcomeHeader={true} />}
    </AlertingPageWrapper>
  );
}

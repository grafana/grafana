import React, { useState } from 'react';

import { Tab, TabContent, TabsBar } from '@grafana/ui';

import GettingStarted from './GettingStarted';
import Insights from './Insights';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';

type HomeTabs = 'insights' | 'gettingStarted';

export default function Home() {
  const [activeTab, setActiveTab] = useState<HomeTabs>('insights');

  return (
    <AlertingPageWrapper pageId={'alerting'}>
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
          label={'Getting started'}
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
    </AlertingPageWrapper>
  );
}

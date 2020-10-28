import React from 'react';
import { TabsBar, TabContent, Tab } from '@grafana/ui';

enum Tabs {
  Query = 'query',
  Instance = 'instance',
}

export const AlertingQueryPreview = ({}) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <TabsBar>
        {[
          { id: 'query', text: 'Query', active: true },
          { id: 'instance', text: 'Alering instance', active: false },
        ].map((tab, index) => {
          return <Tab key={`${tab.id}-${index}`} label={tab.text} onChangeTab={() => {}} />;
        })}
      </TabsBar>
      <TabContent>
        <div>Query result</div>
      </TabContent>
    </div>
  );
};

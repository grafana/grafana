import React, { useState } from 'react';

import { Stack, Tab, TabContent, TabProps, TabsBar } from '@grafana/ui';

import { DashboardScene } from '../../../../../scene/DashboardScene';
import ShareConfiguration from '../../ShareConfiguration';

import { EmailListTab } from './EmailListTab';

const tabs: TabProps[] = [
  {
    label: 'People with access',
    active: true,
    icon: 'lock',
  },
  {
    label: 'Settings',
    active: false,
    icon: 'cog',
  },
];
export const EmailShareTabs = ({ dashboard }: { dashboard: DashboardScene }) => {
  const [state, updateState] = useState(tabs);

  return (
    <Stack gap={2} direction="column">
      <TabsBar>
        {state.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              icon={tab.icon}
              onChangeTab={() =>
                updateState(
                  state.map((tab, idx) => ({
                    ...tab,
                    active: idx === index,
                  }))
                )
              }
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {state[0].active && <EmailListTab dashboard={dashboard} />}
        {state[1].active && <ShareConfiguration dashboard={dashboard} />}
      </TabContent>
    </Stack>
  );
};

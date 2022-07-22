import { Meta, Story } from '@storybook/react';
import React, { useState } from 'react';

import { TabsBar, Tab, TabContent, Counter as TabCounter } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { CounterProps } from './Counter';
import mdx from './TabsBar.mdx';

const meta: Meta = {
  title: 'Layout/Tabs',
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const tabs = [
  { label: '1st child', key: 'first', active: true },
  { label: '2nd child', key: 'second', active: false },
  { label: '3rd child', key: 'third', active: false },
];

export const Simple: Story = () => {
  const [state, updateState] = useState(tabs);
  return (
    <DashboardStoryCanvas>
      <TabsBar>
        {state.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              onChangeTab={() => updateState(state.map((tab, idx) => ({ ...tab, active: idx === index })))}
              counter={(index + 1) * 1000}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {state[0].active && <div>First tab content</div>}
        {state[1].active && <div>Second tab content</div>}
        {state[2].active && <div>Third tab content</div>}
      </TabContent>
    </DashboardStoryCanvas>
  );
};

export const Counter: Story<CounterProps> = (args) => {
  return <TabCounter {...args} />;
};

Counter.args = {
  value: 10,
};

export default meta;

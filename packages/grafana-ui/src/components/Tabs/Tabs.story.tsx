import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import { CounterProps, Counter as TabCounter } from './Counter';
import { Tab } from './Tab';
import { TabContent } from './TabContent';
import { TabsBar } from './TabsBar';
import mdx from './TabsBar.mdx';

const meta: Meta = {
  title: 'Navigation/Tabs',
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

export const Simple: StoryFn = () => {
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

export const Counter: StoryFn<CounterProps> = (args) => {
  return <TabCounter {...args} />;
};

Counter.args = {
  value: 10,
};

export const WithDisabled: StoryFn = () => {
  const [state, updateState] = useState([
    { label: 'Enabled Tab', key: 'first', active: true },
    { label: 'Disabled Tab', key: 'second', active: false, disabled: true },
    { label: 'Another Tab', key: 'third', active: false },
  ]);

  return (
    <DashboardStoryCanvas>
      <TabsBar>
        {state.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              disabled={tab.disabled}
              onChangeTab={() =>
                !tab.disabled && updateState(state.map((tab, idx) => ({ ...tab, active: idx === index })))
              }
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {state[0].active && <div>First tab content</div>}
        {state[1].active && <div>Second tab content (disabled)</div>}
        {state[2].active && <div>Third tab content</div>}
      </TabContent>
    </DashboardStoryCanvas>
  );
};

export default meta;

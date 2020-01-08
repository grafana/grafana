import React from 'react';
import { TabBar } from './TabBar';
import { Tab } from './Tab';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './TabBar.mdx';

export default {
  title: 'UI/Tabs/TabBar',
  component: TabBar,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const tabs = [
  { label: '1st child', key: 'first', hide: false, active: true },
  { label: '2nd child', key: 'second', hide: false, active: false },
  { label: '3rd child', key: 'third', hide: false, active: false },
];

export const Simple = () => {
  return (
    <UseState initialState={tabs}>
      {(state, updateState) => {
        return (
          <TabBar>
            {state.map((tab, index) => {
              return (
                <Tab
                  key={index}
                  label={tab.label}
                  active={tab.active}
                  onChangeTab={() => updateState(state.map((tab, idx) => ({ ...tab, active: idx === index })))}
                />
              );
            })}
          </TabBar>
        );
      }}
    </UseState>
  );
};

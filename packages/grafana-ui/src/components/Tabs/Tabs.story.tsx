import React from 'react';
import { TabsNavigation } from './TabsNavigation';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Tab } from './types';
import mdx from './Tabs.mdx';

export default {
  title: 'UI/Tabs',
  component: TabsNavigation,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const tabs: Tab[] = [
  { label: '1st child', key: 'first', hide: false, active: true },
  { label: '2nd child', key: 'second', hide: false, active: false },
  { label: '3rd child', key: 'third', hide: false, active: false },
];

export const Simple = () => {
  return (
    <UseState initialState={tabs}>
      {(state, updateState) => {
        return (
          <TabsNavigation
            tabs={state}
            onChangeTab={newIndex => {
              updateState(state.map((tab, index) => ({ ...tab, active: newIndex === index })));
            }}
          />
        );
      }}
    </UseState>
  );
};

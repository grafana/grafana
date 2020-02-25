import React from 'react';
import { select } from '@storybook/addon-knobs';
import { TabsBar } from './TabsBar';
import { Tab } from './Tab';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './TabsBar.mdx';

export default {
  title: 'General/Tabs/TabsBar',
  component: TabsBar,
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

export const Simple = () => {
  const VISUAL_GROUP = 'Visual options';
  // ---
  const icon = select(
    'Icon',
    { None: undefined, Heart: 'fa fa-heart', Star: 'fa fa-star', User: 'fa fa-user' },
    undefined,
    VISUAL_GROUP
  );
  return (
    <UseState initialState={tabs}>
      {(state, updateState) => {
        return (
          <TabsBar>
            {state.map((tab, index) => {
              return (
                <Tab
                  key={index}
                  label={tab.label}
                  active={tab.active}
                  icon={icon}
                  onChangeTab={() => updateState(state.map((tab, idx) => ({ ...tab, active: idx === index })))}
                />
              );
            })}
          </TabsBar>
        );
      }}
    </UseState>
  );
};

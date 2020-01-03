import React from 'react';
import { NavModelItem } from '@grafana/data';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Tabs } from './Tabs';
import mdx from './Tabs.mdx';
import { UseState } from '../../utils/storybook/UseState';

export default {
  title: 'UI/Tabs',
  component: Tabs,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const navModelItem: NavModelItem = {
  text: 'Mother tab',
  children: [{ text: '1st child', active: true }, { text: '2nd child' }, { text: '3rd child' }],
};

export const Simple = () => {
  return (
    <UseState initialState={{ navModelItem }}>
      {(state, onChangeTab) => {
        return (
          <Tabs
            main={state.navModelItem}
            onChangeTab={(index: number) => {
              action(`Tab ${index + 1} selected`);
              onChangeTab({
                navModelItem: {
                  ...state.navModelItem,
                  children: state.navModelItem.children?.map((child, i) => {
                    return { ...child, active: i === index };
                  }),
                },
              });
            }}
          />
        );
      }}
    </UseState>
  );
};

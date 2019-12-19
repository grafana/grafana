import React from 'react';
import { NavModelItem } from '@grafana/data';
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
  return <Tabs main={navModelItem} />;
};

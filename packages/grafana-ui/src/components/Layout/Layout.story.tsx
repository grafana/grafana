import { Story, Meta } from '@storybook/react';
import React from 'react';

import { Button, VerticalGroup, HorizontalGroup } from '@grafana/ui';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';

import { Layout, LayoutProps } from './Layout';
import mdx from './Layout.mdx';

export default {
  title: 'Layout/Groups',
  component: Layout,
  decorators: [withStoryContainer, withCenteredStory, withHorizontallyCenteredStory],
  // SB7 has broken subcomponent types due to dropping support for the feature
  // https://github.com/storybookjs/storybook/issues/20782
  // @ts-ignore
  subcomponents: { HorizontalGroup, VerticalGroup },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['orientation'],
    },
  },
  args: {
    justify: 'flex-start',
    spacing: 'sm',
    align: 'center',
    wrap: false,
    width: '100%',
    containerWidth: 300,
    containerHeight: 0,
    showBoundaries: false,
  },
  argTypes: {
    containerWidth: { control: { type: 'range', min: 100, max: 500, step: 10 } },
    containerHeight: { control: { type: 'range', min: 100, max: 500, step: 10 } },
    justify: {
      control: {
        type: 'select',
        options: ['flex-start', 'flex-end', 'space-between', 'center'],
      },
    },
    align: {
      control: {
        type: 'select',
        options: ['flex-start', 'flex-end', 'center', 'normal'],
      },
    },
    spacing: {
      control: {
        type: 'select',
        options: ['xs', 'sm', 'md', 'lg'],
      },
    },
  },
} as Meta;

export const Horizontal: Story<LayoutProps> = (args) => {
  return (
    <HorizontalGroup {...args}>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </HorizontalGroup>
  );
};

export const Vertical: Story<LayoutProps> = (args) => {
  return (
    <VerticalGroup {...args}>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </VerticalGroup>
  );
};

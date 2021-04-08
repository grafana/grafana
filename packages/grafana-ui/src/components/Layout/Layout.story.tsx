import React from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Layout, LayoutProps } from './Layout';
import { Button, VerticalGroup, HorizontalGroup } from '@grafana/ui';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Story, Meta } from '@storybook/react';
import mdx from './Layout.mdx';

export default {
  title: 'Layout/Groups',
  component: Layout,
  decorators: [withStoryContainer, withCenteredStory, withHorizontallyCenteredStory],
  subcomponents: { HorizontalGroup, VerticalGroup },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
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
  },
  argTypes: {
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

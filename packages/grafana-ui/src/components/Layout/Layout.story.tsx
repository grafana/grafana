import { StoryFn, Meta } from '@storybook/react';

import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Button } from '../Button/Button';

import { HorizontalGroup, Layout, LayoutProps, VerticalGroup } from './Layout';
import mdx from './Layout.mdx';

const meta: Meta = {
  title: 'Layout/Deprecated/Groups',
  component: Layout,
  decorators: [withStoryContainer],
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
};

export default meta;

export const Horizontal: StoryFn<LayoutProps> = (args) => {
  return (
    <HorizontalGroup {...args}>
      <Button variant="secondary">Cancel</Button>
      <Button variant="destructive">Delete</Button>
      <Button>Save</Button>
    </HorizontalGroup>
  );
};

export const Vertical: StoryFn<LayoutProps> = (args) => {
  return (
    <VerticalGroup {...args}>
      <Button variant="secondary">Cancel</Button>
      <Button variant="destructive">Delete</Button>
      <Button>Save</Button>
    </VerticalGroup>
  );
};

import { StoryFn, Meta } from '@storybook/react';

import { Button, VerticalGroup, HorizontalGroup } from '@grafana/ui';

import { withStoryContainer } from '../../utils/storybook/withStoryContainer';

import { Layout, LayoutProps } from './Layout';
import mdx from './Layout.mdx';

const meta: Meta = {
  title: 'Layout/Groups',
  component: Layout,
  decorators: [withStoryContainer],
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

import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Stack } from './Stack';
import mdx from './Stack.mdx';

const meta: Meta<typeof Stack> = {
  title: 'General/Layout/Stack',
  component: Stack,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const Item = ({ children }: { children: ReactNode }) => <div style={{ backgroundColor: 'lightgrey' }}>{children}</div>;

export const Basic: StoryFn<typeof Stack> = (args) => {
  return (
    <Stack {...args}>
      <Item>Item 1</Item>
      <Item>Item 2</Item>
      <Item>Item 3</Item>
    </Stack>
  );
};

export default meta;

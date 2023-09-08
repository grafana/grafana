import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { Stack } from './Stack';
import mdx from './Stack.mdx';

const themeTokenControl = { control: 'select', options: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] };

const meta: Meta<typeof Stack> = {
  title: 'General/Layout/Stack',
  component: Stack,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    gap: themeTokenControl,
    direction: { control: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
  },
};

const Item = ({ children }: { children: ReactNode }) => (
  <div style={{ backgroundColor: 'lightgrey', width: '100px', height: '50px' }}>{children}</div>
);

export const Basic: StoryFn<typeof Stack> = ({ direction = 'column', gap = 2 }) => {
  return (
    <Stack direction={direction} gap={gap}>
      <Item>Item 1</Item>
      <Item>Item 2</Item>
      <Item>Item 3</Item>
    </Stack>
  );
};

export default meta;

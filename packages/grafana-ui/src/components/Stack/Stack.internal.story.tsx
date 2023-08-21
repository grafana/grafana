import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Stack } from './Stack';

const meta: Meta<typeof Stack> = {
  title: 'General/Stack',
  component: Stack,
  decorators: [withCenteredStory],
};

const Item = ({ children }: { children: ReactNode }) => <div style={{ backgroundColor: 'lightgrey' }}>{children}</div>;

export const Basic: StoryFn<typeof Stack> = (props) => {
  return (
    <Stack {...props}>
      <Item>Item 1</Item>
      <Item>Item 2</Item>
      <Item>Item 3</Item>
    </Stack>
  );
};

export default meta;

import { Meta, StoryFn } from '@storybook/react';
import React, { ReactNode } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Stack } from './Stack';
import mdx from './Stack.mdx';

const meta: Meta<typeof Stack> = {
  title: 'General/Stack',
  component: Stack,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
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

export const FlexGrowExample: StoryFn<typeof Stack> = () => {
  return (
    <Stack>
      <Stack direction="column">
        <Item>Item 1</Item>
        <Item>Item 2</Item>
        <Item>Item 3</Item>
      </Stack>
      <Stack flexGrow={3}>
        <Item>This Stack</Item>
        <Item>uses</Item>
        <Item>flexGrow={3}</Item>
      </Stack>
    </Stack>
  );
};

export default meta;

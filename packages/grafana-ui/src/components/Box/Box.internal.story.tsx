import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Box } from './Box';
import mdx from './Box.mdx';

const meta: Meta<typeof Box> = {
  title: 'General/Layout/Box',
  component: Box,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['element'] },
  },
};

const Item = () => {
  return (
    <div
      style={{
        width: '100px',
        height: '100px',
        background: 'red',
      }}
    />
  );
};

export const Basic: StoryFn<typeof Box> = (args) => {
  return (
    <div style={{ backgroundColor: 'green' }}>
      <Box {...args}>
        <Item />
      </Box>
    </div>
  );
};

export default meta;

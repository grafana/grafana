import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { Box } from './Box';
import mdx from './Box.mdx';

const themeTokenControl = { control: 'select', options: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] };

const meta: Meta<typeof Box> = {
  title: 'General/Layout/Box',
  component: Box,
  decorators: [withCenteredStory],
  argTypes: {
    grow: { control: 'number' },
    shrink: { control: 'number' },
    margin: themeTokenControl,
    marginX: themeTokenControl,
    marginY: themeTokenControl,
    marginTop: themeTokenControl,
    marginBottom: themeTokenControl,
    marginLeft: themeTokenControl,
    marginRight: themeTokenControl,
    padding: themeTokenControl,
    paddingX: themeTokenControl,
    paddingY: themeTokenControl,
    paddingTop: themeTokenControl,
    paddingBottom: themeTokenControl,
    paddingLeft: themeTokenControl,
    paddingRight: themeTokenControl,
    display: { control: 'select', options: ['flex', 'block', 'inline', 'none'] },
    backgroundColor: { control: 'select', options: ['primary', 'secondary', 'canvas'] },
    borderStyle: { control: 'select', options: ['dashed', 'solid'] },
    borderColor: { control: 'select', options: ['weak', 'medium', 'strong', 'error', 'success', 'warning', 'info'] },
  },
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
        width: '50px',
        height: '50px',
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

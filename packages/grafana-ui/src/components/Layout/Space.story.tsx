import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { Space } from './Space';
import mdx from './Space.mdx';

const meta: Meta<typeof Space> = {
  title: 'General/Layout/Space',
  component: Space,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default meta;

export const Horizontal: StoryFn<typeof Space> = (args) => {
  return (
    <div style={{ display: 'flex' }}>
      <div>Item without space</div>
      <div>Item with right space</div>
      <Space {...args} />
      <div>Item without space</div>
    </div>
  );
};

Horizontal.args = {
  v: 0,
  h: 2,
  layout: 'inline',
};

export const Vertical: StoryFn<typeof Space> = (args) => {
  return (
    <div>
      <div>Item without space</div>
      <div>Item with bottom space</div>
      <Space {...args} />
      <div>Item without space</div>
    </div>
  );
};

Vertical.args = {
  v: 2,
  h: 0,
  layout: 'block',
};

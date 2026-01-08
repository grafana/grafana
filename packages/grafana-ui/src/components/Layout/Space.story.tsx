import { StoryFn, Meta } from '@storybook/react';

import { SpacingTokenControl } from '../../utils/storybook/themeStorybookControls';

import { Box } from './Box/Box';
import { Space } from './Space';
import mdx from './Space.mdx';

const meta: Meta<typeof Space> = {
  title: 'Layout/Space',
  component: Space,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    v: SpacingTokenControl,
    h: SpacingTokenControl,
  },
};

export default meta;

export const Horizontal: StoryFn<typeof Space> = (args) => {
  return (
    <div style={{ display: 'flex' }}>
      <Box borderStyle={'solid'} padding={1}>
        Box without space
      </Box>
      <Box borderStyle={'solid'} padding={1}>
        Box with space on the right
      </Box>
      <Space {...args} />
      <Box borderStyle={'solid'} padding={1}>
        Box without space
      </Box>
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
      <Box borderStyle={'solid'} padding={1}>
        Box without space
      </Box>
      <Box borderStyle={'solid'} padding={1}>
        Box with bottom space
      </Box>
      <Space {...args} />
      <Box borderStyle={'solid'} padding={1}>
        Box without space
      </Box>
    </div>
  );
};

Vertical.args = {
  v: 2,
  h: 0,
  layout: 'block',
};

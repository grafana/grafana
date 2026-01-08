import { Meta, StoryFn } from '@storybook/react';

import { Divider } from './Divider';
import mdx from './Divider.mdx';

const meta: Meta<typeof Divider> = {
  title: 'Layout/Divider',
  component: Divider,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof Divider> = ({ direction, spacing }) => {
  return (
    <div style={{ display: direction === 'vertical' ? 'flex' : 'block', flexDirection: 'row', height: '50px' }}>
      <div>My text here</div>
      <Divider direction={direction} spacing={spacing} />
      <div>My text here</div>
    </div>
  );
};

export const Examples: StoryFn<typeof Divider> = () => {
  return (
    <div>
      <p>Text above horizontal divider</p>
      <Divider />
      <p>Text below horizontal divider</p>
      <div style={{ display: 'flex', flexDirection: 'row', height: '50px' }}>
        <p>Text aside of vertical divider</p>
        <Divider direction="vertical" />
        <p>Text aside of vertical divider</p>
      </div>
    </div>
  );
};

export default meta;

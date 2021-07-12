import { Dropzone } from '@grafana/ui';
import { Meta, Story } from '@storybook/react';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Forms/Dropzone',
  component: Dropzone,
  decorators: [withCenteredStory],
  parameters: {
    // docs: {
    //   page: mdx,
    // },
    // controls: {
    //   exclude: ['className', 'onFileUpload'],
    // },
  },
  // argTypes: {
  //   size: {
  //     control: {
  //       type: 'select',
  //     },
  //     options: ['xs', 'sm', 'md', 'lg'],
  //   },
  // },
} as Meta;

export const Basic: Story = (args) => {
  return <Dropzone {...args} />;
};

import { Dropzone, DropzoneProps } from '@grafana/ui';
import { Meta, Story } from '@storybook/react';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Dropzone.mdx';

export default {
  title: 'Forms/Dropzone',
  component: Dropzone,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    onLoad: { action: 'onLoad' },
  },
} as Meta;

export const Basic: Story<DropzoneProps> = (args) => {
  return <Dropzone {...args} />;
};

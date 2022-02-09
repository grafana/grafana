import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FileUpload } from '@grafana/ui';
import mdx from './FileUpload.mdx';
import { Meta, Story } from '@storybook/react';

export default {
  title: 'Forms/FileUpload',
  component: FileUpload,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'onFileUpload'],
    },
  },
  argTypes: {
    size: {
      control: {
        type: 'select',
      },
      options: ['xs', 'sm', 'md', 'lg'],
    },
  },
} as Meta;

export const Basic: Story = (args) => {
  return (
    <FileUpload
      size={args.size}
      onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
    />
  );
};
Basic.args = {
  size: 'md',
};

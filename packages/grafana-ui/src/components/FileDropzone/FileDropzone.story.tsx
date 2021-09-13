import { FileDropzone, FileDropzoneProps } from '@grafana/ui';
import { Meta, Story } from '@storybook/react';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './FileDropzone.mdx';

export default {
  title: 'Forms/FileDropzone',
  component: FileDropzone,
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

export const Basic: Story<FileDropzoneProps> = (args) => {
  return <FileDropzone {...args} />;
};

export const WithCustomFileList: Story<FileDropzoneProps> = () => {
  return <FileDropzone fileListRenderer={(file) => <div>Custom rendered item {file.file.name}</div>} />;
};

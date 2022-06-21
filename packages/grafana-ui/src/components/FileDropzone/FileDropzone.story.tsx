import { Meta, Story } from '@storybook/react';
import React from 'react';

import { FileDropzone, FileDropzoneProps } from '@grafana/ui';

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
} as Meta;

const Template: Story<FileDropzoneProps> = (args) => <FileDropzone {...args} />;

export const Basic = Template.bind({});

export const WithCustomFileList = Template.bind({});
WithCustomFileList.args = {
  fileListRenderer: (file) => <div>Custom rendered item {file.file.name}</div>,
};

export const OnlyAcceptingCertainFiles = Template.bind({});
OnlyAcceptingCertainFiles.args = {
  options: { accept: { 'application/json': ['.json'] } },
};

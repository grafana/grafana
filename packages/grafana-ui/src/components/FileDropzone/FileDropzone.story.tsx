import { Meta, StoryFn } from '@storybook/react';

import { FileDropzone } from './FileDropzone';
import mdx from './FileDropzone.mdx';

const meta: Meta<typeof FileDropzone> = {
  title: 'Inputs/FileDropzone',
  component: FileDropzone,
  parameters: {
    docs: {
      page: mdx,
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

const Template: StoryFn<typeof FileDropzone> = (args) => <FileDropzone {...args} />;

export const Basic = Template.bind({});

export const WithCustomFileList = Template.bind({});
WithCustomFileList.args = {
  fileListRenderer: (file) => <div>Custom rendered item {file.file.name}</div>,
};

export const OnlyAcceptingCertainFiles = Template.bind({});
OnlyAcceptingCertainFiles.args = {
  options: { accept: { 'application/json': ['.json'] } },
};

export default meta;

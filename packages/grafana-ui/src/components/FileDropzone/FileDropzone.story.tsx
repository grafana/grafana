import { Meta, StoryFn } from '@storybook/react';
import { useId } from 'react';

import { Field } from '../Forms/Field';

import { FileDropzone } from './FileDropzone';
import mdx from './FileDropzone.mdx';

const meta: Meta<typeof FileDropzone> = {
  title: 'Inputs/FileDropzone',
  component: FileDropzone,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const Template: StoryFn<typeof FileDropzone> = (args) => {
  const inputId = useId();
  return (
    <Field label="Test JSON file">
      <FileDropzone {...args} id={inputId} />
    </Field>
  );
};

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

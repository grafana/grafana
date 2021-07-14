import { Meta, Story } from '@storybook/react';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FileListItem as FileListItemComponent, FileListItemProps } from './FileListItem';

export default {
  title: 'Forms/FileListItem',
  component: FileListItemComponent,
  decorators: [withCenteredStory],
  parameters: {
    // docs: {
    //   page: mdx,
    // },
    // controls: {
    //   exclude: ['className', 'onFileUpload'],
    // },
  },
  argTypes: {
    cancelUpload: { action: 'cancelUpload' },
    removeFile: { action: 'removeFile' },
  },
} as Meta;

export const FileListItem: Story<FileListItemProps> = (args) => {
  const file = { name: 'some-file.jpg', size: 123456 };
  return <FileListItemComponent {...args} file={file as any} />;
};

import { Meta, Story } from '@storybook/react';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FileListItem as FileListItemComponent, FileListItemProps } from './FileListItem';
import mdx from './FileListItem.mdx';

export default {
  title: 'Forms/FileListItem',
  component: FileListItemComponent,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    abortUpload: { action: 'abortUpload' },
    retryUpload: { action: 'retryUpload' },
    removeFile: { action: 'removeFile' },
  },
  args: {
    file: { file: { name: 'some-file.jpg', size: 123456 } as any, id: '1', error: new DOMException('error') },
  },
} as Meta;

export const FileListItem: Story<FileListItemProps> = (args) => {
  return <FileListItemComponent {...args} />;
};

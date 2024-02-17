import { Meta, Story } from '@storybook/react';
import React from 'react';

import { FileListItem as FileListItemComponent, FileListItemProps } from './FileListItem';
import mdx from './FileListItem.mdx';

const meta: Meta = {
  title: 'Forms/FileListItem',
  component: FileListItemComponent,
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
    file: { file: { name: 'some-file.jpg', size: 123456 }, id: '1', error: new DOMException('error') },
  },
};

export const FileListItem: Story<FileListItemProps> = (args) => {
  return <FileListItemComponent {...args} />;
};

export default meta;

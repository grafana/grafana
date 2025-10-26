import { Meta, StoryFn } from '@storybook/react';

import { FileListItem as FileListItemComponent, FileListItemProps } from './FileListItem';
import mdx from './FileListItem.mdx';

const meta: Meta = {
  title: 'Inputs/FileListItem',
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

export const FileListItem: StoryFn<FileListItemProps> = (args) => {
  return <FileListItemComponent {...args} />;
};

export default meta;

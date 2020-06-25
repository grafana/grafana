import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FileUpload } from './FileUpload';
import mdx from './FileUpload.mdx';

export default {
  title: 'Forms/FileUpload',
  component: FileUpload,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return (
    <FileUpload
      onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
    />
  );
};

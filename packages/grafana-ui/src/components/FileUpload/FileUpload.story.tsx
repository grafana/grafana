import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FileUpload } from '@grafana/ui';
import mdx from './FileUpload.mdx';
import { useSize } from '../../utils/storybook/useSize';
import { ComponentSize } from '../../types/size';

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

export const Single = () => {
  const size = useSize();
  return (
    <FileUpload
      size={size as ComponentSize}
      onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
    />
  );
};

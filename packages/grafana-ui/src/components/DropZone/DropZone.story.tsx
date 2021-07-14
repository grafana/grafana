import { Dropzone } from '@grafana/ui';
import { Meta, Story } from '@storybook/react';
import React, { useCallback } from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Forms/Dropzone',
  component: Dropzone,
  decorators: [withCenteredStory],
  parameters: {
    // docs: {
    //   page: mdx,
    // },
    // controls: {
    //   exclude: ['className', 'onFileUpload'],
    // },
  },
} as Meta;

export const Basic: Story = (args) => {
  return <Dropzone {...args} />;
};

export const WithFileReader = () => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        const binaryStr = reader.result;
        console.log(binaryStr);
      };
      reader.readAsText(file);
    });
  }, []);

  return (
    <>
      <Dropzone options={{ onDrop }} />
    </>
  );
};

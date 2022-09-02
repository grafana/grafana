import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { FileUpload } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './FileUpload.mdx';

const meta: ComponentMeta<typeof FileUpload> = {
  title: 'Forms/FileUpload',
  component: FileUpload,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'onFileUpload'],
    },
  },
  argTypes: {
    size: {
      control: {
        type: 'select',
      },
      options: ['xs', 'sm', 'md', 'lg'],
    },
  },
};

export const Basic: ComponentStory<typeof FileUpload> = (args) => {
  return (
    <FileUpload
      size={args.size}
      onFileUpload={({ currentTarget }) => console.log('file', currentTarget?.files && currentTarget.files[0])}
    />
  );
};
Basic.args = {
  size: 'md',
};

export default meta;

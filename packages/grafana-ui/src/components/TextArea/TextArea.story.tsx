import React from 'react';
import { TextArea } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Meta, Story } from '@storybook/react';
import mdx from './TextArea.mdx';

export default {
  title: 'Forms/TextArea',
  component: TextArea,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['cols'],
    },
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    containerWidth: { control: { type: 'range', min: 100, max: 500, step: 10 } },
  },
} as Meta;

export const Basic: Story = (args) => {
  return (
    <div style={{ width: args.containerWidth }}>
      <TextArea invalid={args.invalid} placeholder={args.placeholder} cols={args.cols} disabled={args.disabled} />
    </div>
  );
};
Basic.args = {
  invalid: false,
  disabled: false,
  placeholder: 'This is just a placeholder',
  cols: 30,
  containerWidth: 300,
};

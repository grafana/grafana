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
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  argTypes: {
    cols: { control: { type: 'range', min: 5, max: 50, step: 5 } },
    containerWidth: { control: { type: 'range', min: 100, max: 500, step: 10 } },
  },
} as Meta;

export const Simple: Story = (args) => {
  return (
    <div style={{ width: args.containerWidth }}>
      <TextArea invalid={args.invalid} placeholder={args.placeholder} cols={args.cols} disabled={args.disabled} />
    </div>
  );
};
Simple.args = {
  invalid: false,
  disabled: false,
  placeholder: 'This is just a placeholder',
  cols: 30,
  containerWidth: 300,
};

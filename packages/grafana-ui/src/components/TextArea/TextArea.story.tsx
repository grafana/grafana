import { Meta, StoryFn } from '@storybook/react';

import { TextArea } from './TextArea';
import mdx from './TextArea.mdx';

const meta: Meta = {
  title: 'Forms/TextArea',
  component: TextArea,
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
};

export const Basic: StoryFn = (args) => {
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

export default meta;

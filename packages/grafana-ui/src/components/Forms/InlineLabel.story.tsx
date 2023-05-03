import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { InlineLabel, Props } from './InlineLabel';
import mdx from './InlineLabel.mdx';

const meta: ComponentMeta<typeof InlineLabel> = {
  title: 'Forms/InlineLabel',
  component: InlineLabel,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['as'],
    },
  },
  argTypes: {
    children: {
      control: 'text',
    },
    tooltip: {
      control: 'text',
    },
    width: {
      control: 'text',
    },
  },
};

export const Basic = (args: Props) => <InlineLabel {...args} />;

Basic.args = {
  children: 'Simple text',
  width: 'auto',
  tooltip: undefined,
  transparent: false,
  interactive: false,
};

Basic.parameters = {
  controls: {
    exclude: ['as', 'tooltip', 'interactive'],
  },
};

export const WithTooltip = (args: Props) => <InlineLabel {...args} />;

WithTooltip.args = {
  ...Basic.args,
  tooltip: 'Info text',
};

export default meta;

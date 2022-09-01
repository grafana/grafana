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
    transparent: {
      control: 'boolean',
    },
    interactive: {
      control: 'boolean',
    },
    as: {
      table: {
        disable: true,
      },
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
  as: 'label',
};

Basic.argTypes = {
  tooltip: {
    table: {
      disable: true,
    },
  },
};

export const WithTooltip = (args: Props) => <InlineLabel {...args} />;

WithTooltip.args = {
  ...Basic.args,
  tooltip: 'Info text',
};

export default meta;

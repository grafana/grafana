import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { UnitPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './UnitPicker.mdx';

type Props = React.ComponentProps<typeof UnitPicker>;

const meta: ComponentMeta<typeof UnitPicker> = {
  title: 'Pickers and Editors/UnitPicker',
  component: UnitPicker,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange', 'value'],
    },
    docs: mdx,
  },
};

export const Basic: ComponentStory<typeof UnitPicker> = (args: Props) => <UnitPicker {...args} />;

Basic.args = {
  onChange: console.log,
  width: 30,
};

export default meta;

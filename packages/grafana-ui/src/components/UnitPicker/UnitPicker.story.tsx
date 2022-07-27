import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { UnitPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './UnitPicker.mdx';

const meta: ComponentMeta<typeof UnitPicker> = {
  title: 'Pickers and Editors/UnitPicker',
  component: UnitPicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: mdx,
  },
};

export const simple: ComponentStory<typeof UnitPicker> = () => <UnitPicker onChange={(val) => console.log(val)} />;

export default meta;

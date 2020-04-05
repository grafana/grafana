import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UnitPicker } from './UnitPicker';
import mdx from './UnitPicker.mdx';

export default {
  title: 'General/UnitPicker',
  component: UnitPicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: mdx,
  },
};

export const simple = () => <UnitPicker useNewForms onChange={val => console.log(val)} />;
export const old = () => <UnitPicker onChange={val => console.log(val)} />;

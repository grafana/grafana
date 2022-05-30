import React from 'react';

import { UnitPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './UnitPicker.mdx';

export default {
  title: 'Pickers and Editors/UnitPicker',
  component: UnitPicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: mdx,
  },
};

export const simple = () => <UnitPicker onChange={(val) => console.log(val)} />;

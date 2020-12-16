import React from 'react';
import { Colors } from './Colors';

export default {
  title: 'Docs Overview/Colors',
  component: Colors,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const ColorsDemo = () => {
  return <Colors />;
};

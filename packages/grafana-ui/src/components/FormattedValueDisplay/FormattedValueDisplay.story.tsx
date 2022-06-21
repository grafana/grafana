import React from 'react';

import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';

import { FormattedValueDisplay } from './FormattedValueDisplay';
import mdx from './FormattedValueDisplay.mdx';

export default {
  title: 'Visualizations/FormattedValueDisplay',
  component: FormattedValueDisplay,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return <FormattedValueDisplay value={{ text: 'Test value' }} style={{ fontSize: 12 }} />;
};

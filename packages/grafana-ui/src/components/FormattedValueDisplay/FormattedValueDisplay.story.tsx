import React from 'react';
import { FormattedValueDisplay } from './FormattedValueDisplay';
import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';
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

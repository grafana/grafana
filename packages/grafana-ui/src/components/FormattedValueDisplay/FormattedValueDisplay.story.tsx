import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';

import { FormattedValueDisplay } from './FormattedValueDisplay';
import mdx from './FormattedValueDisplay.mdx';

const meta: ComponentMeta<typeof FormattedValueDisplay> = {
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

export default meta;

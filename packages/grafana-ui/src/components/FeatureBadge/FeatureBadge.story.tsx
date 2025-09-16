import { Meta, StoryFn } from '@storybook/react';

import { FeatureState } from '@grafana/data';

import { FeatureBadge } from './FeatureBadge';
import mdx from './FeatureBadge.mdx';

const meta: Meta<typeof FeatureBadge> = {
  title: 'Information/FeatureBadge',
  component: FeatureBadge,
  parameters: {
    docs: { page: mdx },
  },
  argTypes: {
    featureState: { control: { type: 'select', options: ['experimental', 'private preview', 'preview'] } },
    tooltip: { control: 'text' },
  },
};

const Template: StoryFn<typeof FeatureBadge> = (args) => <FeatureBadge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  featureState: FeatureState.preview,
  tooltip: `This feature is in selected mode`,
};

export default meta;

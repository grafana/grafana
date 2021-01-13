import React from 'react';
import { Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { FilterPill, FilterPillProps } from './FilterPill';
import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';
import mdx from './FilterPill.mdx';
import { getAvailableIcons } from '../../types';

export default {
  title: 'General/FilterPill',
  component: FilterPill,
  decorators: [withCenteredStory],
  argTypes: {
    icon: { control: { type: 'select', options: getAvailableIcons() } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: Story<FilterPillProps> = args => {
  return <FilterPill {...args} onClick={action('Pill clicked')} />;
};

Basic.args = {
  selected: false,
  label: 'Test',
  icon: undefined,
};

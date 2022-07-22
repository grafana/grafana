import { Meta, Story } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';

import Indicator, { IndicatorProps } from './Indicator';
import mdx from './Indicator.mdx';

const story: Meta = {
  title: 'Indicator',
  component: Indicator,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default story;

export const BasicIndicator: Story<IndicatorProps> = (args) => {
  return <Indicator {...args}>Copied</Indicator>;
};

export const IndicatorWithIcon: Story<IndicatorProps> = (args) => {
  return (
    <Indicator suffixIcon="check" {...args}>
      Copied
    </Indicator>
  );
};

export const WithAButton: Story<IndicatorProps> = (args) => {
  return (
    <ClipboardButton icon="copy" getText={() => 'hello world'}>
      Copy surprise
    </ClipboardButton>
  );
};

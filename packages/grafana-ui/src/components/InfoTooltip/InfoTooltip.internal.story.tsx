import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { InfoTooltip } from './InfoTooltip';

const meta: Meta<typeof InfoTooltip> = {
  title: 'Overlays/TooltipInternal',
  component: InfoTooltip,
  decorators: [withCenteredStory],
};

export const basic: StoryFn<typeof InfoTooltip> = () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>;

export default meta;

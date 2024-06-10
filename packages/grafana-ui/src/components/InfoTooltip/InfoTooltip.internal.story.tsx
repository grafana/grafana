import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { InfoTooltip } from './InfoTooltip';

const meta: Meta<typeof InfoTooltip> = {
  title: 'Overlays/TooltipInternal',
  component: InfoTooltip,
};

export const basic: StoryFn<typeof InfoTooltip> = () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>;

export default meta;

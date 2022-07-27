import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { VizTooltip } from '../VizTooltip';

import { InfoTooltip } from './InfoTooltip';

const meta: ComponentMeta<typeof InfoTooltip> = {
  title: 'Overlays/TooltipInternal',
  component: VizTooltip,
  decorators: [withCenteredStory],
};

export const basic: ComponentStory<typeof InfoTooltip> = () => (
  <InfoTooltip>This is the content of the tooltip</InfoTooltip>
);

export default meta;

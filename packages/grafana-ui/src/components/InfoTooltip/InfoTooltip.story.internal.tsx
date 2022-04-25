import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { VizTooltip } from '../VizTooltip';

import { InfoTooltip } from './InfoTooltip';

export default {
  title: 'Overlays/TooltipInternal',
  component: VizTooltip,
  decorators: [withCenteredStory],
};

export const basic = () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>;

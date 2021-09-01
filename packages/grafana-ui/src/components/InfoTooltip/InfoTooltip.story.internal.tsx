import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { InfoTooltip } from './InfoTooltip';
import { VizTooltip } from '../VizTooltip';

export default {
  title: 'Overlays/TooltipInternal',
  component: VizTooltip,
  decorators: [withCenteredStory],
};

export const basic = () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>;

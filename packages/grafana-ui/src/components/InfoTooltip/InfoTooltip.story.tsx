import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { InfoTooltip } from './InfoTooltip';
import { Tooltip } from '../Chart/Tooltip';

export default {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  decorators: [withCenteredStory],
};

export const basic = () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>;

import React from 'react';

import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { InfoTooltip } from './InfoTooltip';

const story = storiesOf('UI/Tooltip', module);
story.addDecorator(withCenteredStory);
story.add('InfoTooltip', () => <InfoTooltip>This is the content of the tooltip</InfoTooltip>);

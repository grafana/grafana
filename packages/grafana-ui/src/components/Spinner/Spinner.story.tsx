import React from 'react';

import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Spinner } from './Spinner';

const story = storiesOf('General/Spinner', module);
story.addDecorator(withCenteredStory);
story.add('spinner', () => {
  return (
    <div>
      <Spinner />
    </div>
  );
});

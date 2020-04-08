import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { QueryField } from './QueryField';

const QueryFieldStories = storiesOf('Panel/QueryField', module);

QueryFieldStories.addDecorator(withCenteredStory);

QueryFieldStories.add('default', () => {
  return <QueryField portalOrigin="mock-origin" query="" />;
});

import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ResourceCard } from './ResourceCard';

const ResourceCardStories = storiesOf('UI/ResourceCard', module);

ResourceCardStories.addDecorator(withCenteredStory);

ResourceCardStories.add('default', () => {
  return (
    <ResourceCard
      resourceName={'Storybook'}
      description={'This is a resource card description.'}
      url={'http://localhost:9001'}
      type={'Storybook'}
      isDefault={true}
    />
  );
});

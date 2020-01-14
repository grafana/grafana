import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ResourceCard } from './ResourceCard';

const ResourceCardStories = storiesOf('UI/ResourceCard', module);

ResourceCardStories.addDecorator(withCenteredStory);

ResourceCardStories.add('default', () => {
  return (
    <ResourceCard
      name={<ResourceCard.Name value={'Storybook'} />}
      description={<ResourceCard.Description value={'This is a resource card description.'} />}
      infoItems={[
        <ResourceCard.InfoItem keyName={'url'} value={'http://localhost:9001'} />,
        <ResourceCard.InfoItem keyName={'type'} value={'Storybook'} />,
      ]}
    />
  );
});

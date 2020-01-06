import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ResourceCard } from './ResourceCard';

export default {
  title: 'UI/ResourceCard',
  component: ResourceCard,
  decorators: [withCenteredStory],
  parameters: {},
};

export const simple = () => {
  // const data = [
  //   {
  //     name: 'Production database',
  //     meta: []
  //   }
  // ];

  return <ResourceCard name="" />;
};

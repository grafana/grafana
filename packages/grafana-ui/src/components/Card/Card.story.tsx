import React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Card } from './Card';
import mdx from './Card.mdx';

export default {
  title: 'General/Card',
  component: Card,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const disabled = boolean('Disabled', false, 'Style props');
  return (
    <Card
      title="Filter by name"
      description="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const WithTooltip = () => {
  return (
    <Card
      title="Reduce"
      description="Reduce all rows or data points to a single value using a function like max, min, mean or last."
      tooltip="Click to apply this transformation."
    />
  );
};

export const WithTags = () => {
  return (
    <Card
      title="Elasticsearch – Custom Templated Query"
      description="Elastic Search"
      tags={['elasticsearch', 'test', 'testdata']}
    />
  );
};

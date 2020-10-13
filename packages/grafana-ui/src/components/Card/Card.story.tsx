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

const getKnobs = () => {
  const disabled = boolean('Disabled', false, 'Style props');

  return { disabled };
};
export const Basic = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Filter by name"
      description="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const WithTooltip = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Reduce"
      description="Reduce all rows or data points to a single value using a function like max, min, mean or last."
      tooltip="Click to apply this transformation."
      disabled={disabled}
    />
  );
};

export const WithTags = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Elasticsearch – Custom Templated Query"
      description="Elastic Search"
      tags={['elasticsearch', 'test', 'testdata']}
      disabled={disabled}
    />
  );
};

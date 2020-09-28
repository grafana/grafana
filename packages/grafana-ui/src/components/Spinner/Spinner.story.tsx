import React from 'react';
import { number, color } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Spinner } from '@grafana/ui';
import mdx from './Spinner.mdx';

export default {
  title: 'Visualizations/Spinner',
  component: Spinner,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <div>
      <Spinner />
    </div>
  );
};

export const withStyle = () => {
  return (
    <div>
      <Spinner
        style={{
          backgroundColor: color('White', 'white'),
          color: color('Red', 'red'),
        }}
        size={number('Size', 34)}
      />
    </div>
  );
};

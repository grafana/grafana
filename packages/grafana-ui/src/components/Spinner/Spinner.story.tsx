import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Spinner } from '@grafana/ui';

export default {
  title: 'Visualizations/Spinner',
  component: Spinner,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return (
    <div>
      <Spinner />
    </div>
  );
};

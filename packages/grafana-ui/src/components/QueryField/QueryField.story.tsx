import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { QueryField } from '@grafana/ui';

export default {
  title: 'Data Source/QueryField',
  component: QueryField,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return <QueryField portalOrigin="mock-origin" query="" />;
};

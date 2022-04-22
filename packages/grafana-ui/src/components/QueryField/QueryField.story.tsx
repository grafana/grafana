import React from 'react';

import { QueryField } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Data Source/QueryField',
  component: QueryField,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return <QueryField portalOrigin="mock-origin" query="" />;
};

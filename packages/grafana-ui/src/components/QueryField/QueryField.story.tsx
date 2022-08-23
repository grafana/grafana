import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { QueryField } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const meta: ComponentMeta<typeof QueryField> = {
  title: 'Data Source/QueryField',
  component: QueryField,
  decorators: [withCenteredStory],
};

export const basic: ComponentStory<typeof QueryField> = () => {
  return <QueryField portalOrigin="mock-origin" query="" />;
};

export default meta;

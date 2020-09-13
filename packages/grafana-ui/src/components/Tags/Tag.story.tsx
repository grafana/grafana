import React from 'react';
import { action } from '@storybook/addon-actions';
import { Tag } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Tag.mdx';

export default {
  title: 'Forms/Tags/Tag',
  component: Tag,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return <Tag name="Tag" onClick={action('Tag clicked')} />;
};

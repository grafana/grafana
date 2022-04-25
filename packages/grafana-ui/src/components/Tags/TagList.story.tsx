import { action } from '@storybook/addon-actions';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TagList } from './TagList';
import mdx from './TagList.mdx';

export default {
  title: 'Forms/Tags/TagList',
  component: TagList,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const tags = ['datasource-test', 'gdev', 'mysql', 'mssql'];

export const list = () => {
  return (
    <div style={{ width: 300 }}>
      <TagList tags={tags} onClick={action('Tag clicked')} />
    </div>
  );
};

import React from 'react';
import { TagList } from './TagList';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './TagList.mdx';

export default {
  title: 'General/TagList',
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
      <TagList tags={tags} onClick={tag => console.log(tag)} />
    </div>
  );
};

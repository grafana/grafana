import React from 'react';
import { Tag } from './Tag';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Tag.mdx';

// @ts-ignore
export default {
  title: 'General/Tag',
  component: Tag,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return <Tag name="Tag" onClick={tag => console.log(tag)} />;
};

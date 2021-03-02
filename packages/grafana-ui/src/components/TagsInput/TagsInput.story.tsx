import React, { useState } from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TagsInput } from '@grafana/ui';
import mdx from './TagsInput.mdx';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

export default {
  title: 'Forms/TagsInput',
  component: TagsInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const [tags, setTags] = useState<string[]>([]);
  return <TagsInput tags={tags} onChange={setTags} />;
};

export const WithManyTags = () => {
  const [tags, setTags] = useState<string[]>(['dashboard', 'prod', 'server', 'frontend', 'game', 'kubernetes']);
  return (
    <VerticalGroup>
      <StoryExample name="With many tags">
        <TagsInput tags={tags} onChange={setTags} />
      </StoryExample>
    </VerticalGroup>
  );
};

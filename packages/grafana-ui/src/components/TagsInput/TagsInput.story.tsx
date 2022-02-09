import React, { useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { TagsInput, Props } from './TagsInput';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';
import mdx from './TagsInput.mdx';

export default {
  title: 'Forms/TagsInput',
  component: TagsInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'className', 'tags'],
    },
  },
} as Meta;

type StoryProps = Omit<Props, 'onChange' | 'className' | 'tags'>;

export const Basic: Story<StoryProps> = (props) => {
  const [tags, setTags] = useState<string[]>([]);
  return <TagsInput {...props} tags={tags} onChange={setTags} />;
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

import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';

import { TagsInput } from './TagsInput';
import mdx from './TagsInput.mdx';

const meta: Meta<typeof TagsInput> = {
  title: 'Inputs/TagsInput',
  component: TagsInput,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'className', 'tags'],
    },
  },
};

export const Basic: StoryFn<typeof TagsInput> = (props) => {
  const [tags, setTags] = useState<string[]>([]);
  return <TagsInput {...props} tags={tags} onChange={setTags} />;
};

export const WithManyTags = () => {
  const [tags, setTags] = useState<string[]>(['dashboard', 'prod', 'server', 'frontend', 'game', 'kubernetes']);
  return (
    <StoryExample name="With many tags">
      <TagsInput tags={tags} onChange={setTags} />
    </StoryExample>
  );
};

export default meta;

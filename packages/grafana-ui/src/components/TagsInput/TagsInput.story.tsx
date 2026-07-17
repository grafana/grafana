import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { useState } from 'react';

import { Field } from '../Forms/Field';

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

export const Basic: StoryFn<typeof TagsInput> = ({ disabled, invalid, ...rest }) => {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Field label="Tags" disabled={disabled} invalid={invalid}>
      <TagsInput {...rest} tags={tags} onChange={setTags} />
    </Field>
  );
};

export const WithManyTags: StoryFn<typeof TagsInput> = ({ disabled, invalid, ...rest }) => {
  const [tags, setTags] = useState<string[]>(['dashboard', 'prod', 'server', 'frontend', 'game', 'kubernetes']);
  return (
    <Field label="With many tags" disabled={disabled} invalid={invalid}>
      <TagsInput {...rest} tags={tags} onChange={setTags} />
    </Field>
  );
};

export default meta;

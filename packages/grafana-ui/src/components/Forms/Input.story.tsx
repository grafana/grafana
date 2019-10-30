import React from 'react';
import { boolean, text } from '@storybook/addon-knobs';
import { Input } from './Input';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Input.mdx';

export default {
  title: 'UI/Forms/Input',
  component: Input,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const disabled = boolean('Disabled', false);
  return <Input disabled={disabled} />;
};

export const withLabel = () => {
  const label = text('Label', 'This is a Label');
  const description = text('Description', '');
  return <Input description={description} label={label} />;
};

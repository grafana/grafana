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
  const invalid = boolean('Invalid', false);
  const invalidMessage = text('Invalid message', "There's an error");
  const label = text('Label', 'This is a Label');
  const description = text('Description', '');

  return (
    <Input
      description={description}
      disabled={disabled}
      invalid={invalid}
      invalidMessage={invalidMessage}
      label={label}
    />
  );
};

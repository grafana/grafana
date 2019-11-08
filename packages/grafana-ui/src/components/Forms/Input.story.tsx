import React from 'react';
import { boolean, text, select, number } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Input } from './Input';
import { Button } from './Button';
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
  const invalid = boolean('Invalid input', false);
  const icon = text('Prefix', 'fa fa-check');
  const placeholder = text('Placeholder', 'Enter your name here...');
  const loading = boolean('Suffix', true);
  const before = boolean('Addon before', true);
  const after = boolean('Addon after', true);
  const type = select(
    'Input type',
    {
      text: 'text',
      password: 'password',
      number: 'number',
    },
    'text'
  );
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>Input</div>;
  const addonAfter = <Button variant="secondary">Load</Button>;

  const containerWidth = number('Container width', 300, {
    range: true,
    min: 100,
    max: 500,
    step: 10,
  });
  return (
    <div style={{ width: containerWidth }}>
      <Input
        disabled={disabled}
        invalid={invalid}
        icon={icon}
        loading={loading}
        addonBefore={before && addonBefore}
        addonAfter={after && addonAfter}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
};

import React from 'react';
import { boolean, text } from '@storybook/addon-knobs';
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
  const icon = text('Prefix', 'fa fa-check');
  const loading = boolean('Suffix', true);
  const before = boolean('Addon before', true);
  const after = boolean('Addon after', true);
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>Input</div>;
  const addonAfter = <Button variant="secondary">Load</Button>;

  return (
    <div style={{ width: '300px' }}>
      <Input
        disabled={disabled}
        icon={icon}
        loading={loading}
        addonBefore={before && addonBefore}
        addonAfter={after && addonAfter}
      />
    </div>
  );
};

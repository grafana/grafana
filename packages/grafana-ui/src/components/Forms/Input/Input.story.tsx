import React from 'react';
import { boolean, text, select, number } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { Input } from './Input';
import { Button } from '../../Button';
import mdx from './Input.mdx';
import { getAvailableIcons, IconType } from '../../Icon/types';
import { KeyValue } from '@grafana/data';
import { Icon } from '../../Icon/Icon';

export default {
  title: 'Forms/Input',
  component: Input,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const prefixSuffixOpts = {
    None: null,
    Text: '$',
    ...getAvailableIcons().reduce<KeyValue<string>>((prev, c) => {
      return {
        ...prev,
        [`Icon: ${c}`]: `icon-${c}`,
      };
    }, {}),
  };

  const BEHAVIOUR_GROUP = 'Behaviour props';
  // ---
  const type = select(
    'Type',
    {
      text: 'text',
      password: 'password',
      number: 'number',
    },
    'text',
    BEHAVIOUR_GROUP
  );
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  const invalid = boolean('Invalid', false, BEHAVIOUR_GROUP);
  const loading = boolean('Loading', false, BEHAVIOUR_GROUP);

  const VISUAL_GROUP = 'Visual options';
  // ---
  const placeholder = text('Placeholder', 'Enter your name here...', VISUAL_GROUP);
  const before = boolean('Addon before', false, VISUAL_GROUP);
  const after = boolean('Addon after', false, VISUAL_GROUP);
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>Input</div>;
  const prefix = select('Prefix', prefixSuffixOpts, null, VISUAL_GROUP);
  const suffix = select('Suffix', prefixSuffixOpts, null, VISUAL_GROUP);
  let prefixEl: any = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconType} />;
  }
  let suffixEl: any = suffix;
  if (suffix && suffix.match(/icon-/g)) {
    suffixEl = <Icon name={suffix.replace(/icon-/g, '') as IconType} />;
  }

  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerWidth = number(
    'Container width',
    300,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );

  return (
    <div style={{ width: containerWidth }}>
      <Input
        disabled={disabled}
        invalid={invalid}
        prefix={prefixEl}
        suffix={suffixEl}
        loading={loading}
        addonBefore={before && addonBefore}
        addonAfter={after && addonAfter}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
};

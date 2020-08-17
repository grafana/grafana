import React from 'react';
import { withKnobs, text, boolean, object, select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ButtonCascader } from '@grafana/ui';

export default {
  title: 'Forms/Cascader/ButtonCascader',
  component: ButtonCascader,
  decorators: [withKnobs, withCenteredStory],
};

const getKnobs = () => {
  return {
    disabled: boolean('Disabled', false),
    text: text('Button Text', 'Click me!'),
    icon: select('Icon', ['plus', 'minus', 'table'], 'plus'),
    options: object('Options', [
      {
        label: 'A',
        value: 'A',
        children: [
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ],
      },
      { label: 'D', value: 'D' },
    ]),
  };
};

export const simple = () => {
  const { disabled, text, options } = getKnobs();
  return (
    <ButtonCascader disabled={disabled} options={options} value={['A']}>
      {text}
    </ButtonCascader>
  );
};

export const withIcon = () => {
  const { disabled, text, options, icon } = getKnobs();
  return (
    <ButtonCascader disabled={disabled} options={options} value={['A']} icon={icon}>
      {text}
    </ButtonCascader>
  );
};

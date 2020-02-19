import React, { useState } from 'react';
import { RadioButton, RadioButtonSize } from './RadioButton';
import { boolean, select } from '@storybook/addon-knobs';

export default {
  title: 'Forms/RadioButton',
  component: RadioButton,
};

const sizes: RadioButtonSize[] = ['sm', 'md'];

export const simple = () => {
  const [active, setActive] = useState();
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  const VISUAL_GROUP = 'Visual options';
  const size = select<RadioButtonSize>('Size', sizes, 'md', VISUAL_GROUP);

  return (
    <RadioButton
      disabled={disabled}
      size={size}
      active={active}
      id="standalone"
      onChange={() => {
        setActive(!active);
      }}
    >
      Radio button
    </RadioButton>
  );
};

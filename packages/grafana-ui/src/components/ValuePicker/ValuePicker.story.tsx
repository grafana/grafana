import React from 'react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { ButtonVariant, ValuePicker } from '@grafana/ui';
import { generateOptions } from '../Select/mockOptions';
import { getIconKnob } from '../../utils/storybook/knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ComponentSize } from '../../types/size';
import mdx from './ValuePicker.mdx';

export default {
  title: 'Pickers and Editors/ValuePicker',
  component: ValuePicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};
const VISUAL_GROUP = 'Visual options';
const variants = ['primary', 'secondary', 'destructive', 'link'];
const sizes = ['sm', 'md', 'lg'];
const options = generateOptions();

export const simple = () => {
  const label = text('Label', 'Pick an option', VISUAL_GROUP);
  const variant = select('Variant', variants, 'primary', VISUAL_GROUP);
  const size = select('Size', sizes, 'md', VISUAL_GROUP);
  const isFullWidth = boolean('Is full width', false, VISUAL_GROUP);
  const icon = getIconKnob();
  const menuPlacement = select('Menu placement', ['auto', 'bottom', 'top'], 'auto', VISUAL_GROUP);

  return (
    <div style={{ width: '200px' }}>
      <ValuePicker
        options={options}
        label={label}
        onChange={(v) => console.log(v)}
        variant={variant as ButtonVariant}
        icon={icon}
        isFullWidth={isFullWidth}
        size={size as ComponentSize}
        menuPlacement={menuPlacement}
      />
    </div>
  );
};

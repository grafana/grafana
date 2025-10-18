import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';
import { useId } from 'react';

import { Field } from '../Forms/Field';

import { ColorPickerInput } from './ColorPickerInput';

const meta: Meta<typeof ColorPickerInput> = {
  title: 'Pickers/ColorPickerInput',
  component: ColorPickerInput,
  parameters: {
    controls: {
      exclude: ['onChange', 'onColorChange'],
    },
  },
};

export const Basic: StoryFn<typeof ColorPickerInput> = ({ color }) => {
  const [, updateArgs] = useArgs();
  const id = useId();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center' }}>
      <Field label="Select color">
        <ColorPickerInput
          id={id}
          value={color}
          onChange={(color) => {
            action('Color changed')(color);
            updateArgs({ color });
          }}
        />
      </Field>
    </div>
  );
};

export default meta;

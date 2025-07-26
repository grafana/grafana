import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { ColorPickerInput } from './ColorPickerInput';

const meta: Meta<typeof ColorPickerInput> = {
  title: 'Pickers/ColorPickerInput',
  component: ColorPickerInput,
  parameters: {
    controls: {
      exclude: ['onChange', 'onColorChange'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export const Basic: StoryFn<typeof ColorPickerInput> = ({ color }) => {
  const [, updateArgs] = useArgs();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center' }}>
      <ColorPickerInput
        value={color}
        onChange={(color) => {
          action('Color changed')(color);
          updateArgs({ color });
        }}
      />
    </div>
  );
};

export default meta;

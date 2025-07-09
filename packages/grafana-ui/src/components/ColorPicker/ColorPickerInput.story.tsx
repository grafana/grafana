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

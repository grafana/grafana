import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';
import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { SeriesColorPicker } from './ColorPicker';

const meta: Meta<typeof SeriesColorPicker> = {
  title: 'Pickers/SeriesColorPicker',
  component: SeriesColorPicker,
  parameters: {
    controls: {
      exclude: ['onChange', 'onColorChange'],
    },
  },
  args: {
    enableNamedColors: false,
    color: '#00ff00',
  },
};

export const Basic: StoryFn<typeof SeriesColorPicker> = ({ color, enableNamedColors }) => {
  const [, updateArgs] = useArgs();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <SeriesColorPicker
        enableNamedColors={enableNamedColors}
        yaxis={1}
        onToggleAxis={() => {}}
        color={color}
        onChange={(color) => {
          action('Color changed')(color);
          updateArgs({ color });
        }}
      />
    </div>
  );
};

export default meta;

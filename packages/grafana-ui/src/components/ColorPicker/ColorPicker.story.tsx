import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { useStyles2 } from '../../themes/ThemeContext';
import { clearButtonStyles } from '../Button';

import { ColorPicker, SeriesColorPicker } from './ColorPicker';
import mdx from './ColorPicker.mdx';
import { ColorPickerInput } from './ColorPickerInput';

const meta: Meta<typeof ColorPicker> = {
  title: 'Pickers and Editors/ColorPicker',
  component: ColorPicker,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'onColorChange'],
    },
  },
  args: {
    enableNamedColors: false,
    color: '#00ff00',
  },
};

export const Basic: StoryFn<typeof ColorPicker> = ({ color, enableNamedColors }) => {
  const [, updateArgs] = useArgs();

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <ColorPicker
        enableNamedColors={enableNamedColors}
        color={color}
        onChange={(color: string) => {
          action('Color changed')(color);
          updateArgs({ color });
        }}
      />
    </div>
  );
};

export const SeriesPicker: StoryFn<typeof SeriesColorPicker> = ({ color, enableNamedColors }) => {
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

export const CustomTrigger: StoryFn<typeof ColorPicker> = ({ color, enableNamedColors }) => {
  const [, updateArgs] = useArgs();
  const clearButton = useStyles2(clearButtonStyles);
  return (
    <ColorPicker
      enableNamedColors={enableNamedColors}
      color={color}
      onChange={(color: string) => {
        action('Color changed')(color);
        updateArgs({ color });
      }}
    >
      {({ ref, showColorPicker, hideColorPicker }) => (
        <button
          type="button"
          ref={ref}
          onMouseLeave={hideColorPicker}
          onClick={showColorPicker}
          style={{ color }}
          className={clearButton}
        >
          Open color picker
        </button>
      )}
    </ColorPicker>
  );
};

export const Input: StoryFn<typeof ColorPickerInput> = ({ color }) => {
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

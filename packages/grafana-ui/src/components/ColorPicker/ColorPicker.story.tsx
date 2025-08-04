import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { useStyles2 } from '../../themes/ThemeContext';
import { clearButtonStyles } from '../Button/Button';

import { ColorPicker } from './ColorPicker';
import mdx from './ColorPicker.mdx';

const meta: Meta<typeof ColorPicker> = {
  title: 'Pickers/ColorPicker',
  component: ColorPicker,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'onColorChange'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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

export default meta;

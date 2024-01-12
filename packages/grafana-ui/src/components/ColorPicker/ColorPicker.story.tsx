import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { SeriesColorPicker, ColorPicker, clearButtonStyles, useStyles2 } from '@grafana/ui';

import mdx from './ColorPicker.mdx';
import { ColorPickerInput } from './ColorPickerInput';

const meta: Meta<typeof ColorPicker> = {
  title: 'Pickers and Editors/ColorPicker',
  component: ColorPicker,
  // SB7 has broken subcomponent types due to dropping support for the feature
  // https://github.com/storybookjs/storybook/issues/20782
  // @ts-ignore
  subcomponents: { SeriesColorPicker, ColorPickerInput },
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
  const clearButton = useStyles2(clearButtonStyles);
  return (
    <SeriesColorPicker
      enableNamedColors={enableNamedColors}
      yaxis={1}
      onToggleAxis={() => {}}
      color={color}
      onChange={(color) => {
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
    </SeriesColorPicker>
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

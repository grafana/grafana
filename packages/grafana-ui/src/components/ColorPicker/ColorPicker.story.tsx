import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { SeriesColorPicker, ColorPicker, clearButtonStyles, useStyles2 } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

import mdx from './ColorPicker.mdx';
import { ColorPickerInput } from './ColorPickerInput';

const meta: ComponentMeta<typeof ColorPicker> = {
  title: 'Pickers and Editors/ColorPicker',
  component: ColorPicker,
  subcomponents: { SeriesColorPicker, ColorPickerInput },
  decorators: [withCenteredStory],
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

export const Basic: ComponentStory<typeof ColorPicker> = ({ color, enableNamedColors }) => {
  const [, updateArgs] = useArgs();
  return renderComponentWithTheme(ColorPicker, {
    enableNamedColors,
    color,
    onChange: (color: string) => {
      action('Color changed')(color);
      updateArgs({ color });
    },
  });
};

export const SeriesPicker: ComponentStory<typeof SeriesColorPicker> = ({ color, enableNamedColors }) => {
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

export const Input: ComponentStory<typeof ColorPickerInput> = ({ color }) => {
  const [, updateArgs] = useArgs();
  return (
    <ColorPickerInput
      value={color}
      onChange={(color) => {
        action('Color changed')(color);
        updateArgs({ color });
      }}
    />
  );
};

export default meta;

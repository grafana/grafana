import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, Story } from '@storybook/react';
import React from 'react';

import { SeriesColorPicker, ColorPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

import mdx from './ColorPicker.mdx';
import { ColorPickerInput, ColorPickerInputProps } from './ColorPickerInput';
import { ColorPickerProps } from './ColorPickerPopover';

const meta: Meta = {
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

export const Basic: Story<ColorPickerProps> = ({ color, enableNamedColors }) => {
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

export const SeriesPicker: Story<ColorPickerProps> = ({ color, enableNamedColors }) => {
  const [, updateArgs] = useArgs();
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
        <div ref={ref} onMouseLeave={hideColorPicker} onClick={showColorPicker} style={{ color, cursor: 'pointer' }}>
          Open color picker
        </div>
      )}
    </SeriesColorPicker>
  );
};

export const Input: Story<ColorPickerInputProps> = ({ color }) => {
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

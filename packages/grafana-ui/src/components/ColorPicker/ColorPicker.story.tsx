import React from 'react';
import { Meta, Story } from '@storybook/react';
import { SeriesColorPicker, ColorPicker } from '@grafana/ui';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { ColorPickerProps } from './ColorPickerPopover';
import mdx from './ColorPicker.mdx';

export default {
  title: 'Pickers and Editors/ColorPicker',
  component: ColorPicker,
  subcomponents: { SeriesColorPicker },
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['color', 'onChange', 'onColorChange'],
    },
  },
  args: {
    enableNamedColors: false,
  },
} as Meta;

export const Basic: Story<ColorPickerProps> = ({ enableNamedColors }) => {
  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return renderComponentWithTheme(ColorPicker, {
          enableNamedColors,
          color: selectedColor,
          onChange: (color: any) => {
            action('Color changed')(color);
            updateSelectedColor(color);
          },
        });
      }}
    </UseState>
  );
};

export const SeriesPicker: Story<ColorPickerProps> = ({ enableNamedColors }) => {
  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <SeriesColorPicker
            enableNamedColors={enableNamedColors}
            yaxis={1}
            onToggleAxis={() => {}}
            color={selectedColor}
            onChange={(color) => updateSelectedColor(color)}
          >
            {({ ref, showColorPicker, hideColorPicker }) => (
              <div
                ref={ref}
                onMouseLeave={hideColorPicker}
                onClick={showColorPicker}
                style={{ color: selectedColor, cursor: 'pointer' }}
              >
                Open color picker
              </div>
            )}
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
};

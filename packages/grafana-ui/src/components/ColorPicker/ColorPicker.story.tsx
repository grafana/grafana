import React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { SeriesColorPicker, ColorPicker } from './ColorPicker';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import mdx from './ColorPicker.mdx';

const getColorPickerKnobs = () => {
  return {
    enableNamedColors: boolean('Enable named colors', false),
  };
};

export default {
  title: 'Pickers and Editors/ColorPicker',
  component: ColorPicker,
  subcomponents: { SeriesColorPicker },
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { enableNamedColors } = getColorPickerKnobs();

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

export const seriesColorPicker = () => {
  const { enableNamedColors } = getColorPickerKnobs();

  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <SeriesColorPicker
            enableNamedColors={enableNamedColors}
            yaxis={1}
            onToggleAxis={() => {}}
            color={selectedColor}
            onChange={color => updateSelectedColor(color)}
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

import React from 'react';
import { storiesOf } from '@storybook/react';
import {  boolean } from '@storybook/addon-knobs';
import { SeriesColorPicker, ColorPicker } from './ColorPicker';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getColorPickerKnobs = () => {
  return {
    enableNamedColors: boolean('Enable named colors', false),
  };
};

const ColorPickerStories = storiesOf('UI/ColorPicker/Pickers', module);

ColorPickerStories.addDecorator(withCenteredStory);

ColorPickerStories.add('default', () => {
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
});

ColorPickerStories.add('Series color picker', () => {
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
            <div style={{ color: selectedColor, cursor: 'pointer' }}>Open color picker</div>
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
});

import React from 'react';
import { storiesOf } from '@storybook/react';
import { withKnobs, boolean } from '@storybook/addon-knobs';
import { SeriesColorPicker, ColorPicker } from './ColorPicker';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { getThemeKnob } from '../../utils/storybook/themeKnob';

const getColorPickerKnobs = () => {
  return {
    selectedTheme: getThemeKnob(),
    enableNamedColors: boolean('Enable named colors', false),
  };
};

const ColorPickerStories = storiesOf('UI/ColorPicker/Pickers', module);

ColorPickerStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

ColorPickerStories.add('default', () => {
  const { selectedTheme, enableNamedColors } = getColorPickerKnobs();
  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <ColorPicker
            enableNamedColors={enableNamedColors}
            color={selectedColor}
            onChange={color => {
              action('Color changed')(color);
              updateSelectedColor(color);
            }}
            theme={selectedTheme || undefined}
          />
        );
      }}
    </UseState>
  );
});

ColorPickerStories.add('Series color picker', () => {
  const { selectedTheme, enableNamedColors } = getColorPickerKnobs();

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
            theme={selectedTheme || undefined}
          >
            <div style={{ color: selectedColor, cursor: 'pointer' }}>Open color picker</div>
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
});

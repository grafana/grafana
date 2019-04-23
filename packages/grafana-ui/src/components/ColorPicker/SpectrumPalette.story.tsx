import React from 'react';
import { storiesOf } from '@storybook/react';
import SpectrumPalette from './SpectrumPalette';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const SpectrumPaletteStories = storiesOf('UI/ColorPicker/Palettes/SpectrumPalette', module);

SpectrumPaletteStories.addDecorator(withCenteredStory);

SpectrumPaletteStories.add('default', () => {
  return (
    <UseState initialState="red">
      {(selectedColor, updateSelectedColor) => {
        return renderComponentWithTheme(SpectrumPalette, { color: selectedColor, onChange: updateSelectedColor });
      }}
    </UseState>
  );
});

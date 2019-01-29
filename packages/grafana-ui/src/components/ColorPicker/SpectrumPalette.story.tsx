import React from 'react';
import { storiesOf } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';

import SpectrumPalette from './SpectrumPalette';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { getThemeKnob } from '../../utils/storybook/themeKnob';

const SpectrumPaletteStories = storiesOf('UI/ColorPicker/Palettes/SpectrumPalette', module);

SpectrumPaletteStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

SpectrumPaletteStories.add('Named colors swatch - support for named colors', () => {
  const selectedTheme = getThemeKnob();
  return (
    <UseState initialState="red">
      {(selectedColor, updateSelectedColor) => {
        return <SpectrumPalette theme={selectedTheme} color={selectedColor} onChange={updateSelectedColor} />;
      }}
    </UseState>
  );
});

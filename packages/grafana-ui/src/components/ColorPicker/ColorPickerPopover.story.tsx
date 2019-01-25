import React from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { withKnobs } from '@storybook/addon-knobs';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { getThemeKnob } from '../../utils/storybook/themeKnob';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

const ColorPickerPopoverStories = storiesOf('UI/ColorPicker/Popovers', module);

ColorPickerPopoverStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

ColorPickerPopoverStories.add('default', () => {
  const selectedTheme = getThemeKnob();

  return (
    <ColorPickerPopover
      color="#BC67E6"
      onChange={color => {
        console.log(color);
      }}
      theme={selectedTheme || undefined}
    />
  );
});

ColorPickerPopoverStories.add('SeriesColorPickerPopover', () => {
  const selectedTheme = getThemeKnob();

  return (
    <SeriesColorPickerPopover
      color="#BC67E6"
      onChange={color => {
        console.log(color);
      }}
      theme={selectedTheme || undefined}
    />
  );
});

import { storiesOf } from '@storybook/react';
import { ColorPickerPopover } from './ColorPickerPopover';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
const ColorPickerPopoverStories = storiesOf('UI/ColorPicker/Popovers', module);

ColorPickerPopoverStories.addDecorator(withCenteredStory);

ColorPickerPopoverStories.add('default', () => {
  return renderComponentWithTheme(ColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: any) => {
      console.log(color);
    },
  });
});

ColorPickerPopoverStories.add('SeriesColorPickerPopover', () => {
  return renderComponentWithTheme(SeriesColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: any) => {
      console.log(color);
    },
  });
});

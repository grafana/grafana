import { ColorPickerPopover } from './ColorPickerPopover';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

export default {
  title: 'Pickers and Editors/ColorPicker/Popovers',
  component: ColorPickerPopover,
  subcomponents: { SeriesColorPickerPopover },
  decorators: [withCenteredStory],
};

export const basic = () => {
  return renderComponentWithTheme(ColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: any) => {
      console.log(color);
    },
  });
};

export const seriesColorPickerPopover = () => {
  return renderComponentWithTheme(SeriesColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: any) => {
      console.log(color);
    },
  });
};

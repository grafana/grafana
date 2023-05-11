import { Meta } from '@storybook/react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

import { ColorPickerPopover } from './ColorPickerPopover';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

const meta: Meta<typeof ColorPickerPopover> = {
  title: 'Pickers and Editors/ColorPicker/Popovers',
  component: ColorPickerPopover,
  // SB7 has broken subcomponent types due to dropping support for the feature
  // https://github.com/storybookjs/storybook/issues/20782
  // @ts-ignore
  subcomponents: { SeriesColorPickerPopover },
  decorators: [withCenteredStory],
};

export const basic = () => {
  return renderComponentWithTheme(ColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: string) => {
      console.log(color);
    },
  });
};

export const seriesColorPickerPopover = () => {
  return renderComponentWithTheme(SeriesColorPickerPopover, {
    color: '#BC67E6',
    onChange: (color: string) => {
      console.log(color);
    },
  });
};

export default meta;

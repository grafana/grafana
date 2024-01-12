import { Meta } from '@storybook/react';
import React from 'react';

import { useTheme2 } from '../../themes';

import { ColorPickerPopover } from './ColorPickerPopover';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

const meta: Meta<typeof ColorPickerPopover> = {
  title: 'Pickers and Editors/ColorPicker/Popovers',
  component: ColorPickerPopover,
  // SB7 has broken subcomponent types due to dropping support for the feature
  // https://github.com/storybookjs/storybook/issues/20782
  // @ts-ignore
  subcomponents: { SeriesColorPickerPopover },
};

export const Basic = () => {
  return (
    <div style={{ position: 'absolute' }}>
      <ColorPickerPopover
        color="#BC67E6"
        onChange={(color: string) => {
          console.log(color);
        }}
      />
    </div>
  );
};

export const SeriesColorPickerPopoverExample = () => {
  const theme = useTheme2();

  return (
    <div style={{ position: 'absolute' }}>
      <SeriesColorPickerPopover
        theme={theme}
        color="#BC67E6"
        onChange={(color: string) => {
          console.log(color);
        }}
      />
    </div>
  );
};

export default meta;

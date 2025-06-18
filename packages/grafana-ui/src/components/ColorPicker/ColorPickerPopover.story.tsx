import { Meta } from '@storybook/react';
import { useState } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import mdx from './ColorPicker.mdx';
import { ColorPickerPopover } from './ColorPickerPopover';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

const meta: Meta<typeof ColorPickerPopover> = {
  title: 'Pickers and Editors/ColorPicker/Popovers',
  component: ColorPickerPopover,
  parameters: {
    docs: {
      page: mdx,
    },
  },
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
  const [yAxis, setYAxis] = useState(0);

  return (
    <div style={{ position: 'absolute' }}>
      <SeriesColorPickerPopover
        theme={theme}
        yaxis={yAxis}
        onToggleAxis={() => (yAxis ? setYAxis(0) : setYAxis(2))}
        color="#BC67E6"
        onChange={(color: string) => {
          console.log(color);
        }}
      />
    </div>
  );
};

export default meta;

import { withTheme2 } from '../../themes';
import { InlineField } from '../Forms/InlineField';
import { InlineSwitch } from '../Switch/Switch';
import { PopoverContentProps } from '../Tooltip';

import { ColorPickerPopover, ColorPickerProps } from './ColorPickerPopover';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, PopoverContentProps {
  yaxis?: number;
  onToggleAxis?: () => void;
}

export const SeriesColorPickerPopover = (props: SeriesColorPickerPopoverProps) => {
  const { yaxis, onToggleAxis, color, ...colorPickerProps } = props;

  const customPickers = onToggleAxis
    ? {
        yaxis: {
          name: 'Y-Axis',
          tabComponent() {
            return (
              <InlineField labelWidth={20} label="Use right y-axis">
                <InlineSwitch value={yaxis === 2} label="Use right y-axis" onChange={onToggleAxis} />
              </InlineField>
            );
          },
        },
      }
    : undefined;
  return <ColorPickerPopover {...colorPickerProps} color={color || '#000000'} customPickers={customPickers} />;
};

// This component is to enable SeriesColorPickerPopover usage via series-color-picker-popover directive
export const SeriesColorPickerPopoverWithTheme = withTheme2(SeriesColorPickerPopover);

import { withTheme2 } from '../../themes';
import { t } from '../../utils/i18n';
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
  const yAxisLabel = t('grafana-ui.series-color-picker-popover.y-axis-usage', 'Use right y-axis');
  const customPickers = onToggleAxis
    ? {
        yaxis: {
          name: 'Y-Axis',
          tabComponent() {
            return (
              <InlineField labelWidth={20} label={yAxisLabel}>
                <InlineSwitch value={yaxis === 2} label={yAxisLabel} onChange={onToggleAxis} />
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

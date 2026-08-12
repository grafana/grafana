import { t } from '@grafana/i18n';

import { InlineField } from '../Forms/InlineField';
import { InlineSwitch } from '../Switch/Switch';
import { type PopoverContentProps } from '../Tooltip/types';

import { ColorPickerPopover, type ColorPickerProps } from './ColorPickerPopover';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, PopoverContentProps {
  yaxis?: number;
  onToggleAxis?: () => void;
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-seriescolorpicker--docs
 */
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

/**
 * @alias
 * @deprecated Use `SeriesColorPickerPopover` instead. This export will be removed in a future major release.
 */
export const SeriesColorPickerPopoverWithTheme = SeriesColorPickerPopover;

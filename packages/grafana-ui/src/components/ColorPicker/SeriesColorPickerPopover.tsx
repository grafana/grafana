import { css } from '@emotion/css';
import React from 'react';

import { withTheme2, useStyles2 } from '../../themes';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { PopoverContentProps } from '../Tooltip';

import { ColorPickerPopover, ColorPickerProps } from './ColorPickerPopover';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, PopoverContentProps {
  yaxis?: number;
  onToggleAxis?: () => void;
}

export const SeriesColorPickerPopover = (props: SeriesColorPickerPopoverProps) => {
  const styles = useStyles2(getStyles);
  const { yaxis, onToggleAxis, color, ...colorPickerProps } = props;

  const customPickers = onToggleAxis
    ? {
        yaxis: {
          name: 'Y-Axis',
          tabComponent() {
            return (
              <Switch
                key="yaxisSwitch"
                label="Use right y-axis"
                className={styles.colorPickerAxisSwitch}
                labelClass={styles.colorPickerAxisSwitchLabel}
                checked={yaxis === 2}
                onChange={() => {
                  if (onToggleAxis) {
                    onToggleAxis();
                  }
                }}
              />
            );
          },
        },
      }
    : undefined;
  return <ColorPickerPopover {...colorPickerProps} color={color || '#000000'} customPickers={customPickers} />;
};

// This component is to enable SeriesColorPickerPopover usage via series-color-picker-popover directive
export const SeriesColorPickerPopoverWithTheme = withTheme2(SeriesColorPickerPopover);

const getStyles = () => {
  return {
    colorPickerAxisSwitch: css`
      width: 100%;
    `,
    colorPickerAxisSwitchLabel: css`
      display: flex;
      flex-grow: 1;
    `,
  };
};

import { css, cx } from '@emotion/css';
import React, { useState, forwardRef } from 'react';
import { RgbaStringColorPicker } from 'react-colorful';
import { useThrottleFn } from 'react-use';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Props as InputProps } from '../Input/Input';

import ColorInput from './ColorInput';
import { getStyles as getPaletteStyles } from './SpectrumPalette';

export interface ColorPickerInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string;
  onChange: (color: string) => void;
  /** Format for returning the color in onChange callback, defaults to 'rgb' */
  returnColorAs?: 'rgb' | 'hex';
}

export const ColorPickerInput = forwardRef<HTMLInputElement, ColorPickerInputProps>(
  ({ value = '', onChange, returnColorAs = 'rgb', ...inputProps }, ref) => {
    const [currentColor, setColor] = useState(value);
    const [isOpen, setIsOpen] = useState(false);
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const paletteStyles = useStyles2(getPaletteStyles);

    useThrottleFn(
      (c) => {
        if (c === value) {
          return;
        }
        // Default to an empty string if no color value is available
        if (!c) {
          onChange('');
          return;
        }
        const color = theme.visualization.getColorByName(c);
        if (returnColorAs === 'rgb') {
          onChange(colorManipulator.asRgbString(color));
        } else {
          onChange(colorManipulator.asHexString(color));
        }
      },
      500,
      [currentColor]
    );

    return (
      <ClickOutsideWrapper onClick={() => setIsOpen(false)}>
        <div className={styles.wrapper}>
          {isOpen && !inputProps.disabled && (
            <RgbaStringColorPicker
              data-testid={'color-popover'}
              color={currentColor}
              onChange={setColor}
              className={cx(paletteStyles.root, styles.picker)}
            />
          )}
          <div onClick={() => setIsOpen(true)}>
            <ColorInput {...inputProps} theme={theme} color={currentColor} onChange={setColor} ref={ref} isClearable />
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
);

ColorPickerInput.displayName = 'ColorPickerInput';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      position: relative;
    `,
    picker: css`
      &.react-colorful {
        position: absolute;
        width: 100%;
        z-index: 11;
        bottom: 36px;
      }
    `,
    inner: css`
      position: absolute;
    `,
  };
};

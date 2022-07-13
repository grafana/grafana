import { css } from '@emotion/css';
import React, { useState } from 'react';
import { RgbaStringColorPicker } from 'react-colorful';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import ColorInput from './ColorInput';
export interface ColorPickerInputProps {
  value: string;
}

export const ColorPickerInput = ({ value }: ColorPickerInputProps) => {
  const [currentColor, setColor] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      {pickerOpen && <RgbaStringColorPicker color={currentColor} onChange={setColor} className={styles.picker} />}
      <div onClick={() => setPickerOpen(true)}>
        <ColorInput theme={theme} color={currentColor} onChange={setColor} className={styles.input} />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      position: relative;
    `,
    picker: css`
      position: absolute;
      bottom: 2px;
      padding: 2px;
      border-radius: 8px;
      background: ${theme.colors.border.medium};
    `,
    input: css``,
  };
};

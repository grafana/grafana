import React, { useMemo, useState } from 'react';

import { RgbaStringColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import ColorInput from './ColorInput';
import { GrafanaTheme, getColorForTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles, useTheme } from '../../themes';
import { useThrottleFn } from 'react-use';

export interface SpectrumPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

const SpectrumPalette: React.FunctionComponent<SpectrumPaletteProps> = ({ color, onChange }) => {
  const [currentColor, setColor] = useState(color);
  useThrottleFn(onChange, 500, [currentColor]);

  const theme = useTheme();
  const styles = useStyles(getStyles);

  const rgbaString = useMemo(() => {
    return currentColor.startsWith('rgba')
      ? currentColor
      : tinycolor(getColorForTheme(currentColor, theme)).toRgbString();
  }, [currentColor, theme]);

  return (
    <>
      <RgbaStringColorPicker className={cx(styles.root)} color={rgbaString} onChange={setColor} />

      <ColorInput theme={theme} color={currentColor} onChange={setColor} className={styles.colorInput} />
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  root: css`
    &.react-colorful {
      width: auto;
    }

    .react-colorful {
      &__saturation {
        border-radius: ${theme.border.radius.sm} ${theme.border.radius.sm} 0 0;
      }
      &__alpha {
        border-radius: 0 0 ${theme.border.radius.sm} ${theme.border.radius.sm};
      }
      &__alpha,
      &__hue {
        height: ${theme.spacing.md};
        position: relative;
      }
      &__pointer {
        height: ${theme.spacing.md};
        width: ${theme.spacing.md};
      }
    }
  `,
  colorInput: css`
    margin-top: ${theme.spacing.md};
  `,
});

export default SpectrumPalette;

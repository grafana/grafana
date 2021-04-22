import React, { useMemo } from 'react';

import { RgbaStringColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import ColorInput from './ColorInput';
import { GrafanaTheme, getColorForTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles, useTheme } from '../../themes';

export interface SpectrumPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

const SpectrumPalette: React.FunctionComponent<SpectrumPaletteProps> = ({ color, onChange }) => {
  const theme = useTheme();
  const styles = useStyles(getStyles);

  const rgbaString = useMemo(() => {
    return color.startsWith('rgba') ? color : tinycolor(getColorForTheme(color, theme)).toRgbString();
  }, [color, theme]);

  return (
    <>
      <RgbaStringColorPicker className={cx(styles.root)} color={rgbaString} onChange={onChange} />

      <ColorInput theme={theme} color={color} onChange={onChange} className={styles.colorInput} />
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

import React, { useMemo, useState } from 'react';

import { RgbaStringColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import ColorInput from './ColorInput';
import { GrafanaTheme, getColorForTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles, useTheme2 } from '../../themes';
import { useThrottleFn } from 'react-use';

export interface SpectrumPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

const SpectrumPalette: React.FunctionComponent<SpectrumPaletteProps> = ({ color, onChange }) => {
  const [currentColor, setColor] = useState(color);
  useThrottleFn(onChange, 500, [currentColor]);

  const theme = useTheme2();
  const styles = useStyles(getStyles);

  const rgbaString = useMemo(() => {
    return currentColor.startsWith('rgba')
      ? currentColor
      : tinycolor(getColorForTheme(currentColor, theme.v1)).toRgbString();
  }, [currentColor, theme]);

  return (
    <div className={styles.wrapper}>
      <RgbaStringColorPicker className={cx(styles.root)} color={rgbaString} onChange={setColor} />
      <ColorInput theme={theme} color={currentColor} onChange={setColor} className={styles.colorInput} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    flex-grow: 1;
  `,
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

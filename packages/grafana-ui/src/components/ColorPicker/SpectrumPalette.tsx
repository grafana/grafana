import React, { useMemo, useState } from 'react';

import { RgbaStringColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import ColorInput from './ColorInput';
import { GrafanaThemeV2, getColorForTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '../../themes';
import { useThrottleFn } from 'react-use';

export interface SpectrumPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

const SpectrumPalette: React.FunctionComponent<SpectrumPaletteProps> = ({ color, onChange }) => {
  const [currentColor, setColor] = useState(color);
  useThrottleFn(onChange, 500, [currentColor]);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const rgbaString = useMemo(() => {
    return currentColor.startsWith('rgba')
      ? currentColor
      : tinycolor(getColorForTheme2(currentColor, theme)).toRgbString();
  }, [currentColor, theme]);

  return (
    <>
      <RgbaStringColorPicker className={cx(styles.root)} color={rgbaString} onChange={setColor} />

      <ColorInput theme={theme} color={currentColor} onChange={setColor} className={styles.colorInput} />
    </>
  );
};

const getStyles = (theme: GrafanaThemeV2) => ({
  root: css`
    &.react-colorful {
      width: auto;
    }

    .react-colorful {
      &__saturation {
        border-radius: ${theme.shape.borderRadius()} ${theme.shape.borderRadius()} 0 0;
      }
      &__alpha {
        border-radius: 0 0 ${theme.shape.borderRadius()} ${theme.shape.borderRadius()};
      }
      &__alpha,
      &__hue {
        height: ${theme.spacing(2)};
        position: relative;
      }
      &__pointer {
        height: ${theme.spacing(2)};
        width: ${theme.spacing(2)};
      }
    }
  `,
  colorInput: css`
    margin-top: ${theme.spacing(2)};
  `,
});

export default SpectrumPalette;

import { css } from '@emotion/css';
import { useId, useMemo, useState } from 'react';
import { RgbaStringColorPicker } from 'react-colorful';
import { useThrottleFn } from 'react-use';
import tinycolor from 'tinycolor2';

import { type GrafanaTheme2, colorManipulator } from '@grafana/data/themes';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Field } from '../Forms/Field';
import { Stack } from '../Layout/Stack/Stack';

import ColorInput from './ColorInput';

export interface SpectrumPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

const SpectrumPalette = ({ color, onChange }: SpectrumPaletteProps) => {
  const [currentColor, setColor] = useState(color);
  const colorInputId = useId();

  useThrottleFn(
    (c) => {
      onChange(colorManipulator.asHexString(theme.visualization.getColorByName(c)));
    },
    500,
    [currentColor]
  );

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const rgbaString = useMemo(() => {
    return currentColor.startsWith('rgba')
      ? currentColor
      : tinycolor(theme.visualization.getColorByName(color)).toRgbString();
  }, [currentColor, theme, color]);

  return (
    <Stack direction="column" grow={1} gap={2}>
      <RgbaStringColorPicker className={styles.root} color={rgbaString} onChange={setColor} />
      <Field noMargin label={t('grafana-ui.color-picker.input-label', 'RGBA value')}>
        <ColorInput id={colorInputId} color={rgbaString} onChange={setColor} />
      </Field>
    </Stack>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    '&.react-colorful': {
      width: 'auto',
    },

    '.react-colorful': {
      '&__saturation': {
        borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
      },
      '&__alpha': {
        borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
      },
      '&__alpha, &__hue': {
        height: theme.spacing(2),
        position: 'relative',
      },
      '&__pointer': {
        height: theme.spacing(2),
        width: theme.spacing(2),
      },
    },
  }),
});

export default SpectrumPalette;

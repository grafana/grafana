import { css } from '@emotion/css';
import { Property } from 'csstype';
import { upperFirst } from 'lodash';
import { useMemo } from 'react';

import { GrafanaTheme2, ThemeVizHue } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';

interface NamedColorsGroupProps {
  hue: ThemeVizHue;
  selectedColor?: Property.Color;
  onColorSelect: (colorName: string) => void;
  key?: string;
}

const NamedColorsGroup = ({ hue, selectedColor, onColorSelect, ...otherProps }: NamedColorsGroupProps) => {
  const label = upperFirst(hue.name);
  const styles = useStyles2(getStyles);
  const reversedShades = useMemo(() => {
    return [...hue.shades].reverse();
  }, [hue.shades]);

  return (
    <div className={styles.colorRow}>
      <div className={styles.colorLabel}>{label}</div>
      <div {...otherProps} className={styles.swatchRow}>
        {reversedShades.map((shade) => (
          <ColorSwatch
            key={shade.name}
            aria-label={shade.name}
            variant={shade.primary ? ColorSwatchVariant.Large : ColorSwatchVariant.Small}
            isSelected={shade.name === selectedColor}
            color={shade.color}
            onClick={() => onColorSelect(shade.name)}
          />
        ))}
      </div>
    </div>
  );
};

export default NamedColorsGroup;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    colorRow: css({
      display: 'grid',
      gridTemplateColumns: '25% 1fr',
      gridColumnGap: theme.spacing(2),
      padding: theme.spacing(0.5, 0),

      '&:hover': {
        background: theme.colors.background.secondary,
      },
    }),
    colorLabel: css({
      paddingLeft: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    swatchRow: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      justifyContent: 'space-around',
      flexDirection: 'row',
    }),
  };
};

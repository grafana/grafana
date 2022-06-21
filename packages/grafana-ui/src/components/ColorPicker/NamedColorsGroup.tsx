import { css } from '@emotion/css';
import { Property } from 'csstype';
import { upperFirst } from 'lodash';
import React, { FunctionComponent } from 'react';

import { GrafanaTheme2, ThemeVizHue } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { reverseMap } from '../../utils/reverseMap';

import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';

interface NamedColorsGroupProps {
  hue: ThemeVizHue;
  selectedColor?: Property.Color;
  onColorSelect: (colorName: string) => void;
  key?: string;
}

const NamedColorsGroup: FunctionComponent<NamedColorsGroupProps> = ({
  hue,
  selectedColor,
  onColorSelect,
  ...otherProps
}) => {
  const label = upperFirst(hue.name);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.colorRow}>
      <div className={styles.colorLabel}>{label}</div>
      <div {...otherProps} className={styles.swatchRow}>
        {reverseMap(hue.shades, (shade) => (
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
    colorRow: css`
      display: grid;
      grid-template-columns: 25% 1fr;
      grid-column-gap: ${theme.spacing(2)};
      padding: ${theme.spacing(0.5, 0)};

      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
    colorLabel: css`
      padding-left: ${theme.spacing(2)};
      display: flex;
      align-items: center;
    `,
    swatchRow: css`
      display: flex;
      gap: ${theme.spacing(1)};
      align-items: center;
      justify-content: space-around;
      flex-direction: row;
    `,
  };
};

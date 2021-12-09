import React, { FunctionComponent } from 'react';
import { GrafanaTheme2, ThemeVizColor, ThemeVizHue } from '@grafana/data';
import { Property } from 'csstype';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';
import { useTheme2 } from '../../themes/ThemeContext';
import { css } from '@emotion/css';

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
  const primaryShade = hue.shades.find((shade) => shade.primary)!;
  const secondaryShade = hue.shades.find((shade) => shade.name === selectedColor);
  const selected = secondaryShade || primaryShade.name === selectedColor;
  const label = upperFirst(hue.name);
  const theme = useTheme2();
  const styles = getStyles(theme, selected);

  return (
    <div className={styles.colorRow} style={{}}>
      <div className={styles.colorLabel}>{label}</div>
      <div {...otherProps} className={styles.swatchRow}>
        {primaryShade && (
          <ColorSwatch
            key={primaryShade.name}
            ariaLabel={primaryShade.name}
            isSelected={primaryShade.name === selectedColor}
            variant={ColorSwatchVariant.Large}
            color={primaryShade.color}
            onClick={() => onColorSelect(primaryShade.name)}
          />
        )}
        <div className={styles.swatchContainer}>
          {hue.shades.map(
            (shade) =>
              !shade.primary && (
                <div key={shade.name} style={{ marginRight: '4px' }}>
                  <ColorSwatch
                    key={shade.name}
                    ariaLabel={shade.name}
                    isSelected={shade.name === selectedColor}
                    color={shade.color}
                    onClick={() => onColorSelect(shade.name)}
                  />
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
};

export default NamedColorsGroup;

const getStyles = (theme: GrafanaTheme2, selected: boolean | ThemeVizColor) => {
  return {
    colorRow: css`
      display: grid;
      grid-template-columns: 25% 1fr;
      grid-column-gap: ${theme.spacing(2)};
      background: ${selected ? theme.colors.background.secondary : 'inherit'};
      padding: ${theme.spacing(1, 0)};

      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
    colorLabel: css`
      padding-left: ${theme.spacing(2)};
    `,
    swatchRow: css`
      display: flex;
      flex-direction: row;
    `,
    swatchContainer: css`
      display: flex;
      margin-top: 8px;
    `,
  };
};

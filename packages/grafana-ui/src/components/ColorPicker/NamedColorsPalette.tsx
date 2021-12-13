import React from 'react';
import NamedColorsGroup from './NamedColorsGroup';
import { VerticalGroup } from '../Layout/Layout';
import { ColorSwatch } from './ColorSwatch';
import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export interface NamedColorsPaletteProps {
  color?: string;
  onChange: (colorName: string) => void;
}

export const NamedColorsPalette = ({ color, onChange }: NamedColorsPaletteProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const swatches: JSX.Element[] = [];
  for (const hue of theme.visualization.hues) {
    swatches.push(<NamedColorsGroup key={hue.name} selectedColor={color} hue={hue} onColorSelect={onChange} />);
  }

  return (
    <VerticalGroup spacing="md">
      <div className={styles.popoverContainer}>{swatches}</div>
      <div className={styles.container}>
        <ColorSwatch
          isSelected={color === 'transparent'}
          color={'rgba(0,0,0,0)'}
          label="Transparent"
          onClick={() => onChange('transparent')}
        />
        <ColorSwatch
          isSelected={color === 'text'}
          color={theme.colors.text.primary}
          label="Text color"
          onClick={() => onChange('text')}
        />
      </div>
    </VerticalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-column-gap: ${theme.spacing(2)};
      grid-row-gap: ${theme.spacing(2)};
      flex-grow: 1;
      padding-left: ${theme.spacing(2)};
    `,
    popoverContainer: css`
      display: grid;
      flex-grow: 1;
    `,
  };
};

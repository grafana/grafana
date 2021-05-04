import React from 'react';
import { getNamedColorPalette } from '@grafana/data';
import NamedColorsGroup from './NamedColorsGroup';
import { VerticalGroup } from '../Layout/Layout';
import { ColorSwatch } from './ColorSwatch';
import { useTheme2 } from '../../themes/ThemeContext';

export interface NamedColorsPaletteProps {
  color?: string;
  onChange: (colorName: string) => void;
}

export const NamedColorsPalette = ({ color, onChange }: NamedColorsPaletteProps) => {
  const theme = useTheme2();

  const swatches: JSX.Element[] = [];
  getNamedColorPalette().forEach((colors, hue) => {
    swatches.push(
      <NamedColorsGroup
        key={hue}
        selectedColor={color}
        colors={colors}
        onColorSelect={(color) => {
          onChange(color.name);
        }}
      />
    );
  });

  return (
    <VerticalGroup spacing="md">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridRowGap: theme.spacing(2),
          gridColumnGap: theme.spacing(2),
          flexGrow: 1,
        }}
      >
        {swatches}
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

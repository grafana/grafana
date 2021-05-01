import React from 'react';
import { getNamedColorPalette } from '@grafana/data';
import { Themeable2 } from '../../types/index';
import NamedColorsGroup from './NamedColorsGroup';
import { VerticalGroup } from '../Layout/Layout';
import { ColorSwatch } from './ColorSwatch';

export interface NamedColorsPaletteProps extends Themeable2 {
  color?: string;
  onChange: (colorName: string) => void;
}

export const NamedColorsPalette = ({ color, onChange, theme }: NamedColorsPaletteProps) => {
  const swatches: JSX.Element[] = [];
  getNamedColorPalette().forEach((colors, hue) => {
    swatches.push(
      <NamedColorsGroup
        key={hue}
        theme={theme}
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

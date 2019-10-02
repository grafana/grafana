import React from 'react';
import { Color, getNamedColorPalette } from '../../utils/namedColorsPalette';
import { Themeable } from '../../types/index';
import NamedColorsGroup from './NamedColorsGroup';

interface NamedColorsPaletteProps extends Themeable {
  color?: Color;
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
        onColorSelect={color => {
          onChange(color.name);
        }}
      />
    );
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridRowGap: '24px',
        gridColumnGap: '24px',
      }}
    >
      {swatches}
    </div>
  );
};

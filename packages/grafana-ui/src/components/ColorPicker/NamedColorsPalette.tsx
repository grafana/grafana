import React from 'react';
import { Color, ColorsPalette } from '../../utils/colorsPalette';
import { Themeable } from '../../types/index';
import NamedColorsGroup from './NamedColorsGroup';

interface NamedColorsPaletteProps extends Themeable {
  color?: Color;
  onChange: (colorName: string) => void;
}

const NamedColorsPalette = ({ color, onChange, theme }: NamedColorsPaletteProps) => {
  const swatches: JSX.Element[] = [];

  ColorsPalette.forEach((colors, hue) => {
    swatches.push(
      <NamedColorsGroup
        key={hue}
        theme={theme}
        selectedColor={color}
        colors={colors}
        onColorSelect={color => {
          onChange(color.name)
        }}
      />
    );
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridRowGap: '32px',
        gridColumnGap: '32px',
      }}
    >
      {swatches}
    </div>
  );
};

export default NamedColorsPalette;

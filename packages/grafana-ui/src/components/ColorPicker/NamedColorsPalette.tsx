import React from 'react';
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
  for (const hue of theme.visualization.hues) {
    swatches.push(<NamedColorsGroup key={hue.name} selectedColor={color} hue={hue} onColorSelect={onChange} />);
  }

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
        <div />
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

import React, { FunctionComponent } from 'react';
import { ThemeVizHue } from '@grafana/data';
import { Property } from 'csstype';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';
import { useTheme2 } from '../../themes/ThemeContext';

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

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '25% 1fr',
        gridColumnGap: theme.spacing(2),
        background: selected ? theme.colors.background.secondary : 'inherit',
        padding: theme.spacing(1, 0),
      }}
    >
      <div
        style={{
          paddingLeft: theme.spacing(2),
        }}
      >
        {label}
      </div>
      <div {...otherProps} style={{ display: 'flex', flexDirection: 'row' }}>
        {primaryShade && (
          <ColorSwatch
            key={primaryShade.name}
            isSelected={primaryShade.name === selectedColor}
            variant={ColorSwatchVariant.Large}
            color={primaryShade.color}
            onClick={() => onColorSelect(primaryShade.name)}
          />
        )}
        <div
          style={{
            display: 'flex',
            marginTop: '8px',
          }}
        >
          {hue.shades.map(
            (shade) =>
              !shade.primary && (
                <div key={shade.name} style={{ marginRight: '4px' }}>
                  <ColorSwatch
                    key={shade.name}
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

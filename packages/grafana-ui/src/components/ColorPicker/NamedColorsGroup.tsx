import React, { FunctionComponent } from 'react';
import { ThemeVizHue } from '@grafana/data';
import { Color } from 'csstype';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';

interface NamedColorsGroupProps {
  hue: ThemeVizHue;
  selectedColor?: Color;
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

  return (
    <div {...otherProps} style={{ display: 'flex', flexDirection: 'column' }}>
      {primaryShade && (
        <ColorSwatch
          key={primaryShade.name}
          isSelected={primaryShade.name === selectedColor}
          variant={ColorSwatchVariant.Large}
          color={primaryShade.color}
          label={upperFirst(hue.name)}
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
  );
};

export default NamedColorsGroup;

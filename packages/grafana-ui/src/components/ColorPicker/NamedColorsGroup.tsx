import React, { FunctionComponent, useRef } from 'react';
import { ThemeVizHue } from '@grafana/data';
import { Property } from 'csstype';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';

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
  const ref = useRef(null);
  const primaryShade = hue.shades.find((shade) => shade.primary)!;
  const label = upperFirst(hue.name);

  return (
    <>
      <div>{label}</div>
      <div {...otherProps} style={{ display: 'flex', flexDirection: 'row' }}>
        {primaryShade && (
          <ColorSwatch
            key={primaryShade.name}
            isSelected={primaryShade.name === selectedColor}
            variant={ColorSwatchVariant.Large}
            color={primaryShade.color}
            ref={ref}
            onPress={() => onColorSelect(primaryShade.name)}
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
                    ref={ref}
                    onPress={() => onColorSelect(shade.name)}
                  />
                </div>
              )
          )}
        </div>
      </div>
    </>
  );
};

export default NamedColorsGroup;

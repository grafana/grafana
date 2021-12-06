import React, { FunctionComponent } from 'react';
import { ThemeVizHue } from '@grafana/data';
import { Property } from 'csstype';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';
import { useFocusManager } from '@react-aria/focus';

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
  const focusManager = useFocusManager();
  const label = upperFirst(hue.name);

  const onKeyDownColorSelect = (e: React.KeyboardEvent, colorName: string) => {
    if (e.key === 'Tab' || e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }

    switch (e.key) {
      case 'Enter':
        onColorSelect(colorName);
        break;
      case 'ArrowRight':
        focusManager.focusNext({ wrap: true });
        break;
      case 'ArrowLeft':
        focusManager.focusPrevious({ wrap: true });
        break;
    }
    return;
  };

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
            onClick={() => onColorSelect(primaryShade.name)}
            onKeyDown={(event) => onKeyDownColorSelect(event, primaryShade.name)}
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
                    onKeyDown={(event) => onKeyDownColorSelect(event, shade.name)}
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

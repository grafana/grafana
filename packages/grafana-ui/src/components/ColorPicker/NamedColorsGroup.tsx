import React, { FunctionComponent } from 'react';
import { ColorDefinition } from '@grafana/data';
import { Color } from 'csstype';
import { upperFirst, find } from 'lodash';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { useTheme2 } from '../../themes/ThemeContext';

type ColorChangeHandler = (color: ColorDefinition) => void;

interface NamedColorsGroupProps {
  colors: ColorDefinition[];
  selectedColor?: Color;
  onColorSelect: ColorChangeHandler;
  key?: string;
}

const NamedColorsGroup: FunctionComponent<NamedColorsGroupProps> = ({
  colors,
  selectedColor,
  onColorSelect,
  ...otherProps
}) => {
  const theme = useTheme2();
  const primaryColor = find(colors, (color) => !!color.isPrimary);

  return (
    <div {...otherProps} style={{ display: 'flex', flexDirection: 'column' }}>
      {primaryColor && (
        <ColorSwatch
          key={primaryColor.name}
          isSelected={primaryColor.name === selectedColor}
          variant={ColorSwatchVariant.Large}
          color={primaryColor.variants[theme.colors.mode]}
          label={upperFirst(primaryColor.hue)}
          onClick={() => onColorSelect(primaryColor)}
        />
      )}
      <div
        style={{
          display: 'flex',
          marginTop: '8px',
        }}
      >
        {colors.map(
          (color) =>
            !color.isPrimary && (
              <div key={color.name} style={{ marginRight: '4px' }}>
                <ColorSwatch
                  key={color.name}
                  isSelected={color.name === selectedColor}
                  color={color.variants[theme.colors.mode]}
                  onClick={() => onColorSelect(color)}
                />
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default NamedColorsGroup;

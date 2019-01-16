import React, { FunctionComponent } from 'react';
import { find, upperFirst } from 'lodash';
import { Color, ColorsPalete, ColorDefinition } from '../../utils/colorsPalette';

type ColorChangeHandler = (color: ColorDefinition) => void;

enum ColorSwatchVariant {
  Small = 'small',
  Large = 'large',
}

interface ColorSwatchProps extends React.DOMAttributes<HTMLDivElement> {
  color: ColorDefinition;
  variant?: ColorSwatchVariant;
  isSelected?: boolean;
}

const ColorSwatch: FunctionComponent<ColorSwatchProps> = ({
  color,
  variant = ColorSwatchVariant.Small,
  isSelected,
  ...otherProps
}) => {
  const isSmall = variant === ColorSwatchVariant.Small;
  const swatchSize = isSmall ? '16px' : '32px';
  const swatchStyles = {
    width: swatchSize,
    height: swatchSize,
    borderRadius: '50%',
    background: `${color.variants.dark}`,
    marginRight: isSmall ? '0px' : '8px',
    boxShadow: isSelected ? `inset 0 0 0 2px ${color.variants.dark}, inset 0 0 0 4px white` : 'none',
    cursor: isSelected ? 'default' : 'pointer'
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
      {...otherProps}
    >
      <div style={swatchStyles} />
      {variant === ColorSwatchVariant.Large && <span>{upperFirst(color.hue)}</span>}
    </div>
  );
};

const ColorsGroup = ({
  colors,
  selectedColor,
  onColorSelect,
}: {
  colors: ColorDefinition[];
  selectedColor?: Color;
  onColorSelect: ColorChangeHandler
}) => {
  const primaryColor = find(colors, color => !!color.isPrimary);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {primaryColor && (
        <ColorSwatch
          isSelected={primaryColor.name === selectedColor}
          variant={ColorSwatchVariant.Large}
          color={primaryColor}
          onClick={() => onColorSelect(primaryColor)}
        />
      )}
      <div
        style={{
          display: 'flex',
          marginTop: '8px',
        }}
      >
        {colors.map(color => !color.isPrimary && (
          <div style={{ marginRight: '4px' }}>
            <ColorSwatch
              isSelected={color.name === selectedColor}
              color={color}
              onClick={() => onColorSelect(color)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};


interface NamedColorsPickerProps {
  selectedColor?: Color;
  onChange: ColorChangeHandler;
}
const NamedColorsPicker = ({ selectedColor, onChange }: NamedColorsPickerProps) => {
  const swatches: JSX.Element[] = [];

  ColorsPalete.forEach((colors, hue) => {
    swatches.push(
      <>
        <ColorsGroup selectedColor={selectedColor} colors={colors} onColorSelect={onChange} />
      </>
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

export default NamedColorsPicker;

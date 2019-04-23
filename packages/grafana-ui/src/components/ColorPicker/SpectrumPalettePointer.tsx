import React from 'react';
import { Themeable } from '../../types';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

export interface SpectrumPalettePointerProps extends Themeable {
  direction?: string;
}

const SpectrumPalettePointer: React.FunctionComponent<SpectrumPalettePointerProps> = ({ theme, direction }) => {
  const styles = {
    picker: {
      width: '16px',
      height: '16px',
      transform: direction === 'vertical' ? 'translate(0, -8px)' : 'translate(-8px, 0)',
    },
  };

  const pointerColor = selectThemeVariant(
    {
      light: theme.colors.dark3,
      dark: theme.colors.gray2,
    },
    theme.type
  );

  let pointerStyles: React.CSSProperties = {
    position: 'absolute',
    left: '6px',
    width: '0',
    height: '0',
    borderStyle: 'solid',
    background: 'none',
  };

  let topArrowStyles: React.CSSProperties = {
    top: '-7px',
    borderWidth: '6px 3px 0px 3px',
    borderColor: `${pointerColor} transparent transparent transparent`,
  };

  let bottomArrowStyles: React.CSSProperties = {
    bottom: '-7px',
    borderWidth: '0px 3px 6px 3px',
    borderColor: ` transparent transparent ${pointerColor} transparent`,
  };

  if (direction === 'vertical') {
    pointerStyles = {
      ...pointerStyles,
      left: 'auto',
    };
    topArrowStyles = {
      borderWidth: '3px 0px 3px 6px',
      borderColor: `transparent transparent transparent ${pointerColor}`,
      left: '-7px',
      top: '7px',
    };
    bottomArrowStyles = {
      borderWidth: '3px 6px 3px 0px',
      borderColor: `transparent ${pointerColor} transparent transparent`,
      right: '-7px',
      top: '7px',
    };
  }

  return (
    <div style={styles.picker}>
      <div
        style={{
          ...pointerStyles,
          ...topArrowStyles,
        }}
      />
      <div
        style={{
          ...pointerStyles,
          ...bottomArrowStyles,
        }}
      />
    </div>
  );
};

export default SpectrumPalettePointer;

import React from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface Props {
  disabled: boolean;
  color: string;
  onColorChange: (color: string) => void;
}

export const VizLegendSeriesIcon = React.memo<Props>(
  ({ disabled, color, onColorChange }) => {
    return disabled ? (
      <SeriesIcon color={color} />
    ) : (
      <SeriesColorPicker color={color} onChange={onColorChange} enableNamedColors>
        {({ ref, showColorPicker, hideColorPicker }) => (
          <SeriesIcon
            color={color}
            className="pointer"
            ref={ref}
            onClick={showColorPicker}
            onMouseLeave={hideColorPicker}
          />
        )}
      </SeriesColorPicker>
    );
  },
  // areEqual -- return true if they are the same.
  // onColorChange updates frequently, so ignore that
  (prevProps, nextProps) => {
    return prevProps.color === nextProps.color && prevProps.disabled === nextProps.disabled;
  }
);

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

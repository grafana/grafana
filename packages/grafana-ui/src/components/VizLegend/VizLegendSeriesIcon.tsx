import React from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface Props {
  disabled: boolean;
  color: string;
  onColorChange: (color: string) => void;
}

/**
 * @internal
 */
export const VizLegendSeriesIcon: React.FunctionComponent<Props> = ({ disabled, color, onColorChange }) => {
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
};

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

import React from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface LegendSeriesIconProps {
  color: string;
  yaxis?: number;
  onColorChange: (color: string) => void;
  onToggleAxis?: () => void;
}

export const LegendSeriesIcon: React.FunctionComponent<LegendSeriesIconProps> = ({
  yaxis,
  color,
  onColorChange,
  onToggleAxis,
}) => {
  return (
    <SeriesColorPicker
      yaxis={yaxis}
      color={color}
      onChange={onColorChange}
      onToggleAxis={onToggleAxis}
      enableNamedColors
    >
      {({ ref, showColorPicker, hideColorPicker }) => (
        <span ref={ref} onClick={showColorPicker} onMouseLeave={hideColorPicker} className="graph-legend-icon">
          <SeriesIcon color={color} />
        </span>
      )}
    </SeriesColorPicker>
  );
};

LegendSeriesIcon.displayName = 'LegendSeriesIcon';

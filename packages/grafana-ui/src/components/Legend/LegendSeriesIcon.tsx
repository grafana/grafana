import React from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface LegendSeriesIconProps {
  disabled: boolean;
  color: string;
  yAxis: number;
  onColorChange: (color: string) => void;
  onToggleAxis?: () => void;
}

export const LegendSeriesIcon: React.FunctionComponent<LegendSeriesIconProps> = ({
  disabled,
  yAxis,
  color,
  onColorChange,
  onToggleAxis,
}) => {
  const iconProps = {
    color,
    className: !disabled && 'pointer',
  };

  return disabled ? (
    <span className="graph-legend-icon">
      <SeriesIcon {...iconProps} />
    </span>
  ) : (
    <SeriesColorPicker
      yaxis={yAxis}
      color={color}
      onChange={onColorChange}
      onToggleAxis={onToggleAxis}
      enableNamedColors
    >
      {({ ref, showColorPicker, hideColorPicker }) => (
        <span ref={ref} onClick={showColorPicker} onMouseLeave={hideColorPicker} className="graph-legend-icon">
          <SeriesIcon {...iconProps} />
        </span>
      )}
    </SeriesColorPicker>
  );
};

LegendSeriesIcon.displayName = 'LegendSeriesIcon';

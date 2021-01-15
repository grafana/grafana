import React from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface Props {
  disabled: boolean;
  color: string;
  yAxis: number;
  onColorChange: (color: string) => void;
  onToggleAxis?: () => void;
}

export const VizLegendSeriesIcon: React.FunctionComponent<Props> = ({
  disabled,
  yAxis,
  color,
  onColorChange,
  onToggleAxis,
}) => {
  return disabled ? (
    <SeriesIcon color={color} />
  ) : (
    <SeriesColorPicker
      yaxis={yAxis}
      color={color}
      onChange={onColorChange}
      onToggleAxis={onToggleAxis}
      enableNamedColors
    >
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

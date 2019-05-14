import React from 'react';
import { css, cx } from 'emotion';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon, SeriesIconProps } from './SeriesIcon';

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
  let iconProps: SeriesIconProps = {
    color,
  };

  if (!disabled) {
    iconProps = {
      ...iconProps,
      className: 'pointer',
    };
  }

  return disabled ? (
    <span
      className={cx(
        'graph-legend-icon',
        disabled &&
          css`
            cursor: default;
          `
      )}
    >
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

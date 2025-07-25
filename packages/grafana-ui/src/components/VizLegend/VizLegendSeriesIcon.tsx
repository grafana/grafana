import { memo, useCallback } from 'react';

import { LineStyle } from '@grafana/schema';

import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { usePanelContext } from '../PanelChrome';

import { SeriesIcon } from './SeriesIcon';

interface Props {
  seriesName: string;
  color?: string;
  gradient?: string;
  readonly?: boolean;
  lineStyle?: LineStyle;
  disabled?: boolean;
}

/**
 * @internal
 */
export const VizLegendSeriesIcon = memo(({ seriesName, color, gradient, readonly, lineStyle, disabled }: Props) => {
  const { onSeriesColorChange } = usePanelContext();
  const onChange = useCallback(
    (color: string) => {
      return onSeriesColorChange!(seriesName, color);
    },
    [seriesName, onSeriesColorChange]
  );

  if (seriesName && onSeriesColorChange && color && !readonly) {
    return (
      <SeriesColorPicker color={color} onChange={onChange} enableNamedColors>
        {({ ref, showColorPicker, hideColorPicker }) => (
          <SeriesIcon
            color={color}
            className="pointer"
            ref={ref}
            onClick={showColorPicker}
            onMouseLeave={hideColorPicker}
            lineStyle={lineStyle}
            disabled={disabled}
          />
        )}
      </SeriesColorPicker>
    );
  }
  return <SeriesIcon color={color} gradient={gradient} lineStyle={lineStyle} disabled={disabled} />;
});

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

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
}

/**
 * @internal
 */
export const VizLegendSeriesIcon = memo(({ seriesName, color, gradient, readonly, lineStyle }: Props) => {
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
          />
        )}
      </SeriesColorPicker>
    );
  }
  return <SeriesIcon color={color} gradient={gradient} lineStyle={lineStyle} />;
});

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

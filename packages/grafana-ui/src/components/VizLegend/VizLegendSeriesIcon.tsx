import React, { useCallback } from 'react';

import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { usePanelContext } from '../PanelChrome';

import { SeriesIcon } from './SeriesIcon';

interface Props {
  seriesName: string;
  color?: string;
  gradient?: string;
  readonly?: boolean;
}

/**
 * @internal
 */
export const VizLegendSeriesIcon = React.memo(({ seriesName, color, gradient, readonly }: Props) => {
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
          />
        )}
      </SeriesColorPicker>
    );
  }
  return <SeriesIcon color={color} gradient={gradient} />;
});

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

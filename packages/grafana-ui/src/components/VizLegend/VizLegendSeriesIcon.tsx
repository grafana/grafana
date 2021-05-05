import React, { useCallback } from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { usePanelContext } from '../PanelChrome';
import { SeriesIcon } from './SeriesIcon';

interface Props {
  seriesName: string;
  color: string;
}

/**
 * @internal
 */
export const VizLegendSeriesIcon: React.FunctionComponent<Props> = ({ seriesName, color }) => {
  const { onSeriesColorChange } = usePanelContext();
  const onChange = useCallback(
    (color: string) => {
      return onSeriesColorChange!(seriesName, color);
    },
    [seriesName, onSeriesColorChange]
  );

  if (seriesName && onSeriesColorChange) {
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
  return <SeriesIcon color={color} />;
};

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

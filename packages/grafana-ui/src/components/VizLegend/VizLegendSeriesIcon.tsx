import { memo, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type LineStyle } from '@grafana/schema';

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
        {({ ref, showColorPicker, hideColorPicker, isOpen }) => {
          function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              showColorPicker();
            }
          }
          return (
            <SeriesIcon
              tabIndex={0}
              role="button"
              aria-label={t('grafana-ui.viz-legend.color-picker', 'Edit color for {{seriesName}}', { seriesName })}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              color={color}
              className="pointer"
              ref={ref}
              onClick={showColorPicker}
              onKeyDown={handleKeyDown}
              onMouseLeave={hideColorPicker}
              lineStyle={lineStyle}
            />
          );
        }}
      </SeriesColorPicker>
    );
  }
  return <SeriesIcon color={color} gradient={gradient} lineStyle={lineStyle} />;
});

VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';

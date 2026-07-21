import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;

  // Show a value as string -- when not defined, the raw values will not be shown
  display?: (v: number) => string;
  useStopsPercentage?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

// rough glyph width at the 11px font used by the scale
const APPROX_CHAR_WIDTH = 8;
// rough label line height at the 11px font used by the scale
const APPROX_LABEL_HEIGHT = 15;
// minimum horizontal space between adjacent labels
const LABEL_GAP = 36;
// minimum vertical space between adjacent labels
const VERTICAL_LABEL_GAP = 20;

type Tick = {
  percent: number;
  label: string;
};

export const ColorScale = ({
  colorPalette,
  min,
  max,
  display,
  useStopsPercentage,
  orientation = 'horizontal',
}: Props) => {
  const styles = useStyles2(getStyles);
  const [ref, { width, height }] = useMeasure<HTMLDivElement>();
  const isVertical = orientation === 'vertical';

  const background = useMemo(() => {
    const colors = getGradientStops(colorPalette, useStopsPercentage);
    // vertical scales run from min at the bottom to max at the top
    return `linear-gradient(${isVertical ? '0deg' : '90deg'}, ${colors.join()})`;
  }, [colorPalette, useStopsPercentage, isVertical]);

  let ticks: Tick[] = [];

  if (display) {
    const span = max - min;
    // when the scale bounds are integers, snap intermediate ticks to whole values
    const snapToInt = Number.isInteger(min) && Number.isInteger(max);

    const genTicks = (count: number) =>
      Array.from({ length: count }, (_, i): Tick => {
        let value = min + (i / (count - 1)) * span;

        if (snapToInt) {
          value = Math.round(value);
        }

        return {
          // ticks are placed where their (possibly snapped) value falls on the scale
          percent: span > 0 ? ((value - min) / span) * 100 : i * 100,
          label: display(value),
        };
      });

    // vertical labels stack line-by-line, so their footprint is a constant
    // line height rather than the rendered label width
    const slotSize = (labelLen: number) =>
      isVertical ? APPROX_LABEL_HEIGHT + VERTICAL_LABEL_GAP : labelLen * APPROX_CHAR_WIDTH + LABEL_GAP;

    const length = isVertical ? height : width;

    // min and max are always rendered; intermediate ticks are added when the
    // footprint of the widest rendered label leaves room for them
    let count = 2;

    if (length > 0 && span > 0) {
      count = Math.max(2, Math.floor(length / slotSize(Math.max(display(min).length, display(max).length))));
    }

    ticks = genTicks(count);

    while (count > 2) {
      const maxLabelLen = Math.max(...ticks.map((tick) => tick.label.length));
      const fits = count * slotSize(maxLabelLen) <= length;
      // coarse display formats and integer snapping can collapse adjacent
      // values into identical labels
      const distinct = new Set(ticks.map((tick) => tick.label)).size === count;

      if (fits && distinct) {
        break;
      }

      ticks = genTicks(--count);
    }
  }

  return (
    <div ref={ref} className={isVertical ? styles.scaleWrapperVertical : styles.scaleWrapper}>
      <div className={isVertical ? styles.scaleGradientVertical : styles.scaleGradient} style={{ background }} />
      {ticks.length > 0 && (
        <div
          className={isVertical ? styles.legendValuesVertical : styles.legendValues}
          // labels are absolutely positioned, so the vertical column needs an
          // explicit width to contribute to the intrinsic width of the scale
          style={
            isVertical ? { width: Math.max(...ticks.map((tick) => tick.label.length)) * APPROX_CHAR_WIDTH } : undefined
          }
        >
          {ticks.map(({ percent, label }, i) => {
            // the first tick anchors at the min end, the last at the max end,
            // and intermediates center on their value
            const anchor = i === 0 ? 0 : i === ticks.length - 1 ? 100 : 50;
            const style = isVertical
              ? { bottom: `${percent}%`, transform: anchor ? `translateY(${anchor}%)` : undefined }
              : { left: `${percent}%`, transform: anchor ? `translateX(-${anchor}%)` : undefined };

            return (
              <span key={i} className={isVertical ? styles.legendValueVertical : styles.legendValue} style={style}>
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// max number of stops to sample for smooth gradients
const GRADIENT_STOPS = 10;

const getGradientStops = (colorArray: string[], useStopsPercentage = true): string[] => {
  const colorCount = colorArray.length;

  if (useStopsPercentage && colorCount <= 20) {
    const incr = (1 / colorCount) * 100;
    let per = 0;
    const stops: string[] = [];
    for (const color of colorArray) {
      if (per > 0) {
        stops.push(`${color} ${per}%`);
      } else {
        stops.push(color);
      }
      per += incr;
      stops.push(`${color} ${per}%`);
    }
    return stops;
  }

  const gradientEnd = colorArray[colorCount - 1];
  const skip = Math.ceil(colorCount / GRADIENT_STOPS);
  const gradientStops = new Set<string>();

  for (let i = 0; i < colorCount; i += skip) {
    gradientStops.add(colorArray[i]);
  }

  gradientStops.add(gradientEnd);

  return [...gradientStops];
};

const getStyles = (theme: GrafanaTheme2) => ({
  scaleWrapper: css({
    width: '100%',
    fontSize: '11px',
  }),
  scaleGradient: css({
    height: '9px',
    borderRadius: theme.shape.radius.default,
  }),
  legendValues: css({
    position: 'relative',
    height: theme.spacing(2),
  }),
  legendValue: css({
    position: 'absolute',
    top: 0,
    whiteSpace: 'nowrap',
    color: theme.colors.text.disabled,
  }),
  scaleWrapperVertical: css({
    display: 'flex',
    height: '100%',
    fontSize: '11px',
  }),
  scaleGradientVertical: css({
    width: '9px',
    borderRadius: theme.shape.radius.default,
  }),
  legendValuesVertical: css({
    position: 'relative',
    marginLeft: theme.spacing(1),
  }),
  legendValueVertical: css({
    position: 'absolute',
    left: 0,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: theme.colors.text.disabled,
  }),
});

import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;

  // Show a value as string -- when not defined, the raw values will not be shown
  display?: (v: number) => string;
  useStopsPercentage?: boolean;
};

export const ColorScale = ({ colorPalette, min, max, display, useStopsPercentage }: Props) => {
  const styles = useStyles2(getStyles);

  const background = useMemo(() => {
    const colors = getGradientStops(colorPalette, useStopsPercentage);
    return `linear-gradient(90deg, ${colors.join()})`;
  }, [colorPalette, useStopsPercentage]);

  return (
    <div className={styles.scaleWrapper}>
      <div className={styles.scaleGradient} style={{ background }} />
      {display && (
        <div className={styles.legendValues}>
          <span className={styles.disabled}>{display(min)}</span>
          <span className={styles.disabled}>{display(max)}</span>
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
    display: 'flex',
    justifyContent: 'space-between',
  }),
  disabled: css({
    color: theme.colors.text.disabled,
  }),
});

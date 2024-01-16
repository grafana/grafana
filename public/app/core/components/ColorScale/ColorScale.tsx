import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;

  // Show a value as string -- when not defined, the raw values will not be shown
  display?: (v: number) => string;
  hoverValue?: number;
  useStopsPercentage?: boolean;
};

type HoverState = {
  isShown: boolean;
  value: number;
};

const GRADIENT_STOPS = 10;

export const ColorScale = ({ colorPalette, min, max, display, hoverValue, useStopsPercentage }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  const [scaleHover, setScaleHover] = useState<HoverState>({ isShown: false, value: 0 });
  const [percent, setPercent] = useState<number | null>(null); // 0-100 for CSS percentage

  const theme = useTheme2();
  const styles = getStyles(theme, colors);

  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette, stops: GRADIENT_STOPS, useStopsPercentage }));
  }, [colorPalette, useStopsPercentage]);

  const onScaleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const divOffset = event.nativeEvent.offsetX;
    const offsetWidth = event.currentTarget.offsetWidth;
    const normPercentage = Math.floor((divOffset * 100) / offsetWidth + 1);
    const scaleValue = Math.floor(((max - min) * normPercentage) / 100 + min);

    setScaleHover({ isShown: true, value: scaleValue });
    setPercent(normPercentage);
  };

  const onScaleMouseLeave = () => {
    setScaleHover({ isShown: false, value: 0 });
  };

  useEffect(() => {
    setPercent(hoverValue == null ? null : clampPercent100((hoverValue - min) / (max - min)));
  }, [hoverValue, min, max]);

  return (
    <div className={styles.scaleWrapper} onMouseMove={onScaleMouseMove} onMouseLeave={onScaleMouseLeave}>
      <div className={styles.scaleGradient}>
        {display && (scaleHover.isShown || hoverValue !== undefined) && (
          <div className={styles.followerContainer}>
            <div className={styles.follower} style={{ left: `${percent}%` }} />
          </div>
        )}
      </div>
      {display && (
        <div className={styles.followerContainer}>
          <div className={styles.legendValues}>
            <span className={styles.disabled}>{display(min)}</span>
            <span className={styles.disabled}>{display(max)}</span>
          </div>
          {percent != null && (scaleHover.isShown || hoverValue !== undefined) && (
            <span className={styles.hoverValue} style={{ left: `${percent}%` }}>
              {display(hoverValue ?? scaleHover.value)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const getGradientStops = ({
  colorArray,
  stops,
  useStopsPercentage = true,
}: {
  colorArray: string[];
  stops: number;
  useStopsPercentage?: boolean;
}): string[] => {
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
  const skip = Math.ceil(colorCount / stops);
  const gradientStops = new Set<string>();

  for (let i = 0; i < colorCount; i += skip) {
    gradientStops.add(colorArray[i]);
  }

  gradientStops.add(gradientEnd);

  return [...gradientStops];
};

function clampPercent100(v: number) {
  if (v > 1) {
    return 100;
  }
  if (v < 0) {
    return 0;
  }
  return v * 100;
}

const getStyles = (theme: GrafanaTheme2, colors: string[]) => ({
  scaleWrapper: css({
    width: '100%',
    fontSize: '11px',
    opacity: 1,
  }),
  scaleGradient: css({
    background: `linear-gradient(90deg, ${colors.join()})`,
    height: '9px',
    pointerEvents: 'none',
    borderRadius: theme.shape.radius.default,
  }),
  legendValues: css({
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  }),
  hoverValue: css({
    position: 'absolute',
    marginTop: '-14px',
    padding: '3px 15px',
    transform: 'translateX(-50%)',
  }),
  followerContainer: css({
    position: 'relative',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  }),
  follower: css({
    position: 'absolute',
    height: '13px',
    width: '13px',
    borderRadius: theme.shape.radius.default,
    transform: 'translateX(-50%) translateY(-50%)',
    border: `2px solid ${theme.colors.text.primary}`,
    top: '5px',
  }),
  disabled: css({
    color: theme.colors.text.disabled,
  }),
});

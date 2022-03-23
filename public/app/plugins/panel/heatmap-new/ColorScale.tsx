import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;

  // Show a value as string -- when not defined, the raw values will not be shown
  display?: (v: number) => string;
  hoverValue?: number;
};

type HoverState = {
  isShown: boolean;
  value: number;
};

const LEFT_OFFSET = 2;

export const ColorScale = ({ colorPalette, min, max, display, hoverValue }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  const [scaleHover, setScaleHover] = useState<HoverState>({ isShown: false, value: 0 });
  const [percent, setPercent] = useState<number | null>(null);

  const theme = useTheme2();
  const styles = getStyles(theme, colors);

  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette }));
  }, [colorPalette]);

  const onScaleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const divOffset = event.nativeEvent.offsetX;
    const offsetWidth = (event.target as any).offsetWidth as number;
    const normPercentage = Math.floor((divOffset * 100) / offsetWidth + 1);
    const scaleValue = Math.floor(((max - min) * normPercentage) / 100 + min);

    setScaleHover({ isShown: true, value: scaleValue });
    setPercent(normPercentage);
  };

  const onScaleMouseLeave = () => {
    setScaleHover({ isShown: false, value: 0 });
  };

  useEffect(() => {
    if (hoverValue != null) {
      const percent = hoverValue / (max - min);
      setPercent(percent * 100);
    }
  }, [hoverValue, min, max]);

  return (
    <div className={styles.scaleWrapper}>
      <div className={styles.scaleGradient} onMouseMove={onScaleMouseMove} onMouseLeave={onScaleMouseLeave}>
        {display && (scaleHover.isShown || hoverValue !== undefined) && (
          <div className={styles.followerContainer}>
            <div className={styles.follower} style={{ left: `${percent}%` }} />
          </div>
        )}
      </div>
      {display && (
        <div className={styles.followerContainer}>
          {percent != null && (scaleHover.isShown || hoverValue !== undefined) && (
            <span className={styles.hoverValue} style={{ left: `${percent - LEFT_OFFSET}%` }}>
              {display(hoverValue || scaleHover.value)}
            </span>
          )}
          <div className={styles.legendValues} style={{ opacity: scaleHover.isShown || hoverValue ? 0.3 : 1 }}>
            <span>{display(min)}</span>
            <span>{display(max)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const getGradientStops = ({ colorArray, stops = 10 }: { colorArray: string[]; stops?: number }): string[] => {
  const colorCount = colorArray.length;
  if (colorCount <= 20) {
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

const getStyles = (theme: GrafanaTheme2, colors: string[]) => ({
  scaleWrapper: css`
    width: 100%;
    max-width: 300px;
    margin-left: 25px;
    padding: 10px 0;
    font-size: 11px;
    opacity: 1;
  `,
  scaleGradient: css`
    background: linear-gradient(90deg, ${colors.join()});
    height: 10px;
  `,
  legendValues: css`
    display: flex;
    justify-content: space-between;
  `,
  hoverValue: css`
    position: absolute;
    padding-top: 5px;
  `,
  followerContainer: css`
    position: relative;
  `,
  follower: css`
    position: absolute;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    transform: translateX(-50%) translateY(-50%);
    pointer-events: none;
    border: 2px solid ${theme.colors.text.primary};
    margin-top: 5px;
  `,
});

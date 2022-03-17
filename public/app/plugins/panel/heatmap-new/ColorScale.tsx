import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { HeatmapData } from './fields';
import { HeatmapHoverEvent } from './utils';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;

  // Show a value as string -- when not defined, the raw values will not be shown
  display?: (v: number) => string;
  data?: HeatmapData;
  hover?: HeatmapHoverEvent | undefined;
};

type HoverState = {
  isShown: boolean;
  value: number;
};

type CursorState = {
  xPosition: number;
  yPosition: number;
};

const OFFSET = 8;

export const ColorScale = ({ colorPalette, min, max, display, data, hover }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  const [scaleHover, setScaleHover] = useState<HoverState>({ isShown: false, value: 0 });
  const [cursor, setCursor] = useState<CursorState>({ xPosition: 0, yPosition: 0 });
  const [hoverCount, setHoverCount] = useState<number | undefined>(undefined);
  const [colorScaleRect, setColorScaleRect] = useState<DOMRect>();

  const colorScaleRef = useRef<HTMLDivElement>();

  const theme = useTheme2();
  const styles = getStyles(theme, colors, scaleHover, cursor);

  useLayoutEffect(() => {
    if (colorScaleRef.current) {
      setColorScaleRect(colorScaleRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette }));
  }, [colorPalette]);

  const onScaleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const divOffset = event.nativeEvent.offsetX;
    const offsetWidth = (event.target as any).offsetWidth as number;
    const normPercentage = Math.floor((divOffset * 100) / offsetWidth + 1);
    const scaleValue = Math.floor(((max - min) * normPercentage) / 100 + min);
    setScaleHover({ isShown: true, value: scaleValue });
    setCursor({ xPosition: event.clientX, yPosition: event.clientY });
  };

  const onScaleMouseLeave = () => {
    setScaleHover({ isShown: false, value: 0 });
  };

  const setPositionByCount = useCallback(
    (count: number) => {
      if (colorScaleRect) {
        const left = colorScaleRect.left; // 50
        const right = colorScaleRect.right; // 350

        console.log(colorScaleRect);

        const percentage = count / (max - min);
        const x = colorScaleRect.width * percentage + left;

        setCursor({ xPosition: x, yPosition: colorScaleRect.top });

        console.log(cursor);
      }
    },
    [colorScaleRect, cursor, max, min]
  );

  useEffect(() => {
    if (hover) {
      const countField = data.heatmap?.fields[2];
      const countVals = countField?.values.toArray();
      const count = countVals?.[hover.index];

      setPositionByCount(count);
      setHoverCount(count);
    }
  }, [hover, data, setPositionByCount]);

  return (
    <div className={styles.scaleWrapper}>
      <div
        className={styles.scaleGradient}
        onMouseMove={onScaleMouseMove}
        onMouseLeave={onScaleMouseLeave}
        ref={colorScaleRef}
      >
        {display && scaleHover.isShown && (
          <div>
            <div
              className={styles.tooltip}
              style={{
                display: 'block',
                position: 'fixed',
                top: cursor.yPosition + OFFSET,
                left: cursor.xPosition + OFFSET,
              }}
            >
              ≈{display(scaleHover.value)}
            </div>
            <div className={styles.follower} />
          </div>
        )}
      </div>
      {display && (
        <div className={styles.count}>
          <span>{display(min)}</span>
          <span className={styles.maxCount}>{display(max)}</span>
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

const getStyles = (theme: GrafanaTheme2, colors: string[], hover: HoverState, cursor: CursorState) => ({
  scaleWrapper: css`
    margin-left: 25px;
    width: 100%;
    max-width: 300px;
    color: #ccccdc;
    font-size: 11px;
    opacity: 1;
  `,
  scaleGradient: css`
    background: linear-gradient(90deg, ${colors.join()});
    height: 12px;
    overflow: hidden;
    // cursor: ew-resize;
  `,
  maxCount: css`
    float: right;
    margin-right: -3px;
  `,
  count: css`
    ${hover.isShown &&
    `
      opacity: 0.6;
      transition: 0.3s;
      `}
  `,
  tooltip: css`
    font-size: 11px;
  `,
  follower: css`
    position: fixed;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    transform: translateX(-50%) translateY(-50%);
    pointer-events: none;
    z-index: 10000;
    border: 2px solid white;
    transition: all 100ms ease-out;
    top: ${cursor.yPosition}px;
    left: ${cursor.xPosition}px;
  `,
});

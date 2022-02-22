import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, VizTooltipContainer } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;
};

export const ColorScale = ({ colorPalette, min, max }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  const [hover, setHover] = useState({ isShown: false, value: null });
  const [cursor, setCursor] = useState({ clientX: 0, clientY: 0 });

  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette }));
  }, [colorPalette]);

  const theme = useTheme2();
  const styles = getStyles(theme, colors);

  const onScaleMouseMove = (event) => {
    const divOffset = event.nativeEvent.offsetX;
    const offsetWidth = event.target.offsetWidth;
    let normPercentage = Math.floor((divOffset * 100) / offsetWidth + 1);
    let scaleValue = Math.floor(((max - min) * normPercentage) / 100 + min);
    setHover({ isShown: true, value: scaleValue });
    setCursor({ clientX: event.clientX, clientY: event.clientY });
  };

  const onScaleMouseLeave = () => {
    setHover({ isShown: false, value: null });
  };

  return (
    <div className={styles.scaleWrapper}>
      <div>
        <div className={styles.scaleGradient} onMouseMove={onScaleMouseMove} onMouseLeave={onScaleMouseLeave}>
          {hover.isShown && (
            <VizTooltipContainer position={{ x: cursor.clientX, y: cursor.clientY }} offset={{ x: 10, y: 10 }}>
              {hover.value}
            </VizTooltipContainer>
          )}
        </div>
        <div>
          <span>{min}</span>
          <span className={styles.maxDisplay}>{max}</span>
        </div>
      </div>
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
    margin: 0 16px;
    padding-top: 4px;
    width: 100%;
    max-width: 300px;
    color: #ccccdc;
    font-size: 11px;
  `,
  scaleGradient: css`
    background: linear-gradient(90deg, ${colors.join()});
    height: 6px;
  `,
  maxDisplay: css`
    float: right;
  `,
});

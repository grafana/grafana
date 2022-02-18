import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
  min: number;
  max: number;
};

export const ColorScale = ({ colorPalette, min, max }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette }));
  }, [colorPalette]);

  const theme = useTheme2();
  const styles = getStyles(theme, colors);

  return (
    <div className={styles.scaleWrapper}>
      <div>
        <div className={styles.scaleGradient} />
        <div className={styles.scaleValues}>
          <span>{min}</span>
          <span className={styles.maxDisplay}>{max}</span>
        </div>
      </div>
    </div>
  );
};

const getGradientStops = ({ colorArray, stops = 10 }: { colorArray: string[]; stops?: number }): string[] => {
  const colorCount = colorArray.length;
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
  `,
  scaleGradient: css`
    background: linear-gradient(90deg, ${colors.join()});
    height: 6px;
  `,
  scaleValues: css`
    color: #ccccdc;
    font-size: 11px;
  `,
  maxDisplay: css`
    float: right;
  `,
});

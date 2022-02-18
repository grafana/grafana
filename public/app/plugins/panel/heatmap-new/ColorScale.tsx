import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

type Props = {
  colorPalette: string[];
};

export const ColorScale = ({ colorPalette }: Props) => {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    setColors(getGradientStops({ colorArray: colorPalette }));
  }, [colorPalette]);

  const theme = useTheme2();
  const styles = getStyles(theme, colors);

  // @ts-ignore
  return (
    <div className={styles.scaleWrapper}>
      <div className={styles.scaleGradient} />
    </div>
  );
};

const getGradientStops = ({ colorArray, stops = 10 }: { colorArray: string[]; stops?: number }): string[] => {
  const gradientEnd = colorArray[colorArray.length - 1];
  const colorCount = colorArray.length;
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
    margin: 10px;
  `,
});

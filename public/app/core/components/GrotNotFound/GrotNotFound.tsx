import { css } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import notFoundSvg from '../../../../../public/img/grot-not-found.svg';

import useMousePosition from './useMousePosition';

export interface Props {
  width?: number;
  height?: number;
}

export const GrotNotFound = ({ width, height }: Props) => {
  const { x, y } = useMousePosition();
  const styles = useStyles2(getStyles, x, y);
  return <SVG src={notFoundSvg} className={styles.svg} height={height} width={width} />;
};

GrotNotFound.displayName = 'GrotNotFound';

const getStyles = (theme: GrafanaTheme2, xPos: number | null, yPos: number | null) => {
  const { innerWidth, innerHeight } = window;
  const heightRatio = yPos && yPos / innerHeight;
  const widthRatio = xPos && xPos / innerWidth;
  const rotation = heightRatio !== null ? getIntermediateValue(heightRatio, -20, 5) : 0;
  const translation = widthRatio !== null ? getIntermediateValue(widthRatio, -5, 5) : 0;

  return {
    svg: css({
      '#grot-not-found-arm, #grot-not-found-magnifier': {
        transform: `rotate(${rotation}deg) translateX(${translation}%)`,
        transformOrigin: 'center',
        transition: 'transform 50ms linear',
      },
    }),
  };
};

/**
 * Given a start value, end value, and a ratio, return the intermediate value
 * Works with negative and inverted start/end values
 */
const getIntermediateValue = (ratio: number, start: number, end: number) => {
  const value = ratio * (end - start) + start;
  return value;
};

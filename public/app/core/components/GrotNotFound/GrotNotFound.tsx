import { css } from '@emotion/css';
import React, { SVGProps } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import dark404 from '../../../../img/grot-404-dark.svg';
import light404 from '../../../../img/grot-404-light.svg';

import useMousePosition from './useMousePosition';

const MIN_ARM_ROTATION = -20;
const MAX_ARM_ROTATION = 5;
const MIN_ARM_TRANSLATION = -5;
const MAX_ARM_TRANSLATION = 5;

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
  show404?: boolean;
}

export const GrotNotFound = ({ width = 'auto', height, show404 = false }: Props) => {
  const theme = useTheme2();
  const { x, y } = useMousePosition();
  const styles = useStyles2(getStyles, x, y, show404);
  return <SVG src={theme.isDark ? dark404 : light404} className={styles.svg} height={height} width={width} />;
};

GrotNotFound.displayName = 'GrotNotFound';

const getStyles = (theme: GrafanaTheme2, xPos: number | null, yPos: number | null, show404: boolean) => {
  const { innerWidth, innerHeight } = window;
  const heightRatio = yPos && yPos / innerHeight;
  const widthRatio = xPos && xPos / innerWidth;
  const rotation = heightRatio !== null ? getIntermediateValue(heightRatio, MIN_ARM_ROTATION, MAX_ARM_ROTATION) : 0;
  const translation =
    widthRatio !== null ? getIntermediateValue(widthRatio, MIN_ARM_TRANSLATION, MAX_ARM_TRANSLATION) : 0;

  return {
    svg: css({
      '#grot-404-arm, #grot-404-magnifier': {
        transform: `rotate(${rotation}deg) translateX(${translation}%)`,
        transformOrigin: 'center',
        transition: 'transform 50ms linear',
      },
      '#grot-404-text': {
        display: show404 ? 'block' : 'none',
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

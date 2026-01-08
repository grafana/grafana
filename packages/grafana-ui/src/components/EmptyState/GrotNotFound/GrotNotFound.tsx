import { css } from '@emotion/css';
import { SVGProps, useEffect, useRef } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import notFoundSvg from './grot-not-found.svg';

const MIN_ARM_ROTATION = -20;
const MAX_ARM_ROTATION = 5;
const MIN_ARM_TRANSLATION = -5;
const MAX_ARM_TRANSLATION = 5;

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
}

export const GrotNotFound = ({ width = 'auto', height }: Props) => {
  const svgRef = useRef<SVGElement>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // don't apply animation if reduced motion preference is set
      if (window.matchMedia('(prefers-reduced-motion: reduce').matches) {
        return;
      }

      const grotArm = svgRef.current?.querySelector('#grot-not-found-arm');
      const grotMagnifier = svgRef.current?.querySelector('#grot-not-found-magnifier');

      const { clientX, clientY } = event;
      const { innerWidth, innerHeight } = window;
      const heightRatio = clientY / innerHeight;
      const widthRatio = clientX / innerWidth;
      const rotation = getIntermediateValue(heightRatio, MIN_ARM_ROTATION, MAX_ARM_ROTATION);
      const translation = getIntermediateValue(widthRatio, MIN_ARM_TRANSLATION, MAX_ARM_TRANSLATION);

      window.requestAnimationFrame(() => {
        grotArm?.setAttribute('style', `transform: rotate(${rotation}deg) translateX(${translation}%)`);
        grotMagnifier?.setAttribute('style', `transform: rotate(${rotation}deg) translateX(${translation}%)`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return <SVG innerRef={svgRef} src={notFoundSvg} className={styles.svg} height={height} width={width} />;
};

GrotNotFound.displayName = 'GrotNotFound';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    svg: css({
      '#grot-not-found-arm, #grot-not-found-magnifier': {
        transformOrigin: 'center',
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

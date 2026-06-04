import { css, keyframes } from '@emotion/css';
import { type SVGProps, useEffect, useRef } from 'react';
import SVG from 'react-inlinesvg';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import notFoundSvg from './grot-not-found.svg';

const MIN_ARM_ROTATION = -20;
const MAX_ARM_ROTATION = 5;
const MIN_ARM_TRANSLATION = -5;
const MAX_ARM_TRANSLATION = 5;
const MAX_FACE_TRANSLATE = 2.5;
const MAX_TILT = 5;
const SHADOW_COUNTER = 1.5;

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
}

export const GrotNotFound = ({ width = 'auto', height }: Props) => {
  const svgRef = useRef<SVGElement>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const { clientX, clientY } = event;
      const { innerWidth, innerHeight } = window;
      const widthRatio = clientX / innerWidth;
      const heightRatio = clientY / innerHeight;

      const rotation = getIntermediateValue(heightRatio, MIN_ARM_ROTATION, MAX_ARM_ROTATION);
      const translation = getIntermediateValue(widthRatio, MIN_ARM_TRANSLATION, MAX_ARM_TRANSLATION);
      const faceX = getIntermediateValue(widthRatio, -MAX_FACE_TRANSLATE, MAX_FACE_TRANSLATE);
      const faceY = getIntermediateValue(heightRatio, -MAX_FACE_TRANSLATE, MAX_FACE_TRANSLATE);
      const tiltY = getIntermediateValue(widthRatio, -MAX_TILT, MAX_TILT);
      const tiltX = getIntermediateValue(heightRatio, MAX_TILT, -MAX_TILT);

      window.requestAnimationFrame(() => {
        const root = svgRef.current;
        if (!root) {
          return;
        }
        const armTransform = `transform: rotate(${rotation}deg) translateX(${translation}%)`;
        const faceTransform = `transform: translate(${faceX}px, ${faceY}px)`;
        root.querySelector('#grot-not-found-arm')?.setAttribute('style', armTransform);
        root.querySelector('#grot-not-found-magnifier')?.setAttribute('style', armTransform);
        root.querySelector('#grot-not-found-mouth')?.setAttribute('style', faceTransform);
        root.querySelector('#grot-not-found-eyes')?.setAttribute('style', faceTransform);
        root
          .querySelector('#grot-not-found-shadow')
          ?.setAttribute('style', `transform: translateX(${-translation * SHADOW_COUNTER}px)`);
        root.style.transform = `perspective(900px) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // @ts-expect-error react-inlinesvg@4.3.0 return type includes bigint, which isn't in @types/react@18's ReactNode. Remove when we update @types/react.
  return <SVG innerRef={svgRef} src={notFoundSvg} className={styles.svg} height={height} width={width} />;
};

GrotNotFound.displayName = 'GrotNotFound';

const blink = keyframes({
  '0%, 92%, 100%': { transform: 'scaleY(1)' },
  '94%, 96%': { transform: 'scaleY(0.05)' },
});

const sparkle = keyframes({
  '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
  '50%': { opacity: 1, transform: 'scale(1.08)' },
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    svg: css({
      transformStyle: 'preserve-3d',
      willChange: 'transform',

      '#grot-not-found-arm, #grot-not-found-magnifier': {
        transformOrigin: 'center',
      },
      '#grot-not-found-mouth, #grot-not-found-mouth-blink, #grot-not-found-eyes, #grot-not-found-eyes-blink, #grot-not-found-shadow, #grot-not-found-decorations':
        {
          transformBox: 'fill-box',
          transformOrigin: 'center',
        },

      [theme.transitions.handleMotion('no-preference')]: {
        '#grot-not-found-eyes-blink': {
          animation: `${blink} 5.5s ease-in-out infinite`,
        },
        '#grot-not-found-decorations': {
          animation: `${sparkle} 3.2s ease-in-out infinite`,
        },
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

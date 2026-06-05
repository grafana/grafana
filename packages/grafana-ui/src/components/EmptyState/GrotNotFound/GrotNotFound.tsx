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
const MAX_SHADOW_TRANSLATION = 10;
const MAX_MAGNIFIER_TILT_Y = 10;
const MAX_MAGNIFIER_TILT_X = 6;

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

      const armRotation = getInterpolatedValue(heightRatio, MIN_ARM_ROTATION, MAX_ARM_ROTATION);
      const armTranslation = getInterpolatedValue(widthRatio, MIN_ARM_TRANSLATION, MAX_ARM_TRANSLATION);
      const faceX = getInterpolatedValue(widthRatio, -MAX_FACE_TRANSLATE, MAX_FACE_TRANSLATE);
      const faceY = getInterpolatedValue(heightRatio, -MAX_FACE_TRANSLATE, MAX_FACE_TRANSLATE);
      const tiltX = getInterpolatedValue(heightRatio, MAX_TILT, -MAX_TILT);
      const tiltY = getInterpolatedValue(widthRatio, -MAX_TILT, MAX_TILT);
      const magTiltX = getInterpolatedValue(heightRatio, -MAX_MAGNIFIER_TILT_X, MAX_MAGNIFIER_TILT_X);
      const magTiltY = getInterpolatedValue(widthRatio, MAX_MAGNIFIER_TILT_Y, -MAX_MAGNIFIER_TILT_Y);
      const shadowX = getInterpolatedValue(widthRatio, -MAX_SHADOW_TRANSLATION, MAX_SHADOW_TRANSLATION);

      window.requestAnimationFrame(() => {
        const root = svgRef.current;
        if (!root) {
          return;
        }
        const armTransform = `transform: rotate(${armRotation}deg) translateX(${armTranslation}%)`;
        const faceTransform = `transform: translate(${faceX}px, ${faceY}px)`;
        root.querySelector('#grot-not-found-arm')?.setAttribute('style', armTransform);
        root.querySelector('#grot-not-found-magnifier')?.setAttribute('style', armTransform);
        root
          .querySelector('#grot-not-found-magnifier-tilt')
          ?.setAttribute('style', `transform: perspective(500px) rotateY(${magTiltY}deg) rotateX(${magTiltX}deg)`);
        root.querySelector('#grot-not-found-mouth')?.setAttribute('style', faceTransform);
        root.querySelector('#grot-not-found-eyes')?.setAttribute('style', faceTransform);
        root.querySelector('#grot-not-found-shadow')?.setAttribute('style', `transform: translateX(${-shadowX}px)`);
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
      '#grot-not-found-magnifier-tilt': {
        transformBox: 'fill-box',
        // Pivot near where the hand grips the handle so the base stays put while the glass tilts
        transformOrigin: '30% 90%',
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
 * Given a start value, end value, and a ratio, return the interpolated value
 * Works with negative and inverted start/end values
 */
const getInterpolatedValue = (ratio: number, start: number, end: number) => {
  const value = ratio * (end - start) + start;
  return value;
};

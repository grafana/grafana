import { css } from '@emotion/css';
import { type SVGProps, useEffect, useRef } from 'react';
import SVG from 'react-inlinesvg';

import { type GrafanaTheme2 } from '@grafana/data';

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
      const grotLensScene = svgRef.current?.querySelector('#grot-not-found-lens-scene');

      const { clientX, clientY } = event;
      const { innerWidth, innerHeight } = window;
      const heightRatio = clientY / innerHeight;
      const widthRatio = clientX / innerWidth;
      const rotation = getIntermediateValue(heightRatio, MIN_ARM_ROTATION, MAX_ARM_ROTATION);
      const translation = getIntermediateValue(widthRatio, MIN_ARM_TRANSLATION, MAX_ARM_TRANSLATION);

      window.requestAnimationFrame(() => {
        const transform = `transform: rotate(${rotation}deg) translateX(${translation}%)`;
        grotArm?.setAttribute('style', transform);
        grotMagnifier?.setAttribute('style', transform);
        // Cancel the magnifier transform so its contents stay aligned with the static artwork.
        grotLensScene?.setAttribute('style', `transform: translateX(${-translation}%) rotate(${-rotation}deg)`);
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    svg: css({
      '--grot-lens-backing': theme.colors.background.primary,
      '#grot-not-found-arm, #grot-not-found-magnifier, #grot-not-found-lens-scene': {
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

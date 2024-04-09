import { CSSInterpolation } from '@emotion/css';

/**
 * @param styles - Regular styles.
 * @param reducedMotionStyles - Styles to apply when `prefers-reduced-motion` is enabled.
 * If @param reducedMotionStyles is not provided, there won't be any animation or transition shown.
 */
export const handleReducedMotion = (styles: CSSInterpolation, reducedMotionStyles?: CSSInterpolation) => {
  const result: Record<string, CSSInterpolation> = {
    '@media (prefers-reduced-motion: no-preference)': styles,
  };
  if (reducedMotionStyles) {
    result['@media (prefers-reduced-motion: reduce)'] = reducedMotionStyles;
  }
  return result;
};

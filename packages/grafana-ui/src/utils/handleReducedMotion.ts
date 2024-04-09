import { CSSInterpolation } from '@emotion/css';

/**
 * @param styles - Styles to apply when no `prefers-reduced-motion` preference is set.
 * @param reducedMotionStyles - Styles to apply when `prefers-reduced-motion` is enabled.
 * Applies one of `styles` or `reducedMotionStyles` depending on a users `prefers-reduced-motion` setting. Omitting `reducedMotionStyles` entirely will result in no styles being applied when `prefers-reduced-motion` is enabled. In most cases this is a reasonable default.
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

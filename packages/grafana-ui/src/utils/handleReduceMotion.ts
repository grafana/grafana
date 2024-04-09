import { CSSInterpolation } from '@emotion/css';

export const handleReduceMotion = (styles: CSSInterpolation, reduceMotionStyles?: CSSInterpolation) => {
  const result: Record<string, CSSInterpolation> = {
    '@media (prefers-reduced-motion: no-preference)': styles,
  };
  if (reduceMotionStyles) {
    result['@media (prefers-reduced-motion: reduce)'] = reduceMotionStyles;
  }
  return result;
};

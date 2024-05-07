import createEmotion from '@emotion/css/create-instance';
export { CSSInterpolation } from '@emotion/css/create-instance';

export const { flush, hydrate, cx, merge, getRegisteredStyles, injectGlobal, keyframes, css, sheet, cache } =
  createEmotion({ key: 'css', stylisPlugins: [] });

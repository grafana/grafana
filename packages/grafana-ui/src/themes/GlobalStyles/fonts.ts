import { css } from '@emotion/react';

import interMedium from '../../../../../public/fonts/inter/Inter-Medium.woff2';
import interRegular from '../../../../../public/fonts/inter/Inter-Regular.woff2';
import robotoMonoNormal from '../../../../../public/fonts/roboto/L0xTDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vrtSM1J-gEPT5Ese6hmHSh0mQ.woff2';

export function getFontStyles() {
  const robotoCommonFontFaceStyles = {
    fontFamily: 'Roboto Mono',
    fontStyle: 'normal',
    fontDisplay: 'swap',
    src: `url(${robotoMonoNormal}) format('woff2')`,
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  };

  const interCommonFontFaceStyles = {
    fontFamily: 'Inter',
    fontStyle: 'normal',
    fontDisplay: 'swap',
  };

  return css([
    {
      /* latin */
      '@font-face': {
        ...robotoCommonFontFaceStyles,
        fontWeight: 400,
      },
    },
    {
      /* latin */
      '@font-face': {
        ...robotoCommonFontFaceStyles,
        fontWeight: 500,
      },
    },
    {
      /*
    To add new variations/version of Inter, download from https://rsms.me/inter/ and add the
    web font files to the public/fonts/inter folder. Do not download the fonts from Google Fonts
    or somewhere else because they don't support the features we require (like tabular numerals).

    If adding additional weights, consider switching to the InterVariable variable font as combined
    it may take less space than multiple static weights.
    */
      '@font-face': {
        ...interCommonFontFaceStyles,
        src: `url(${interRegular}) format('woff2')`,
        fontWeight: 400,
      },
    },
    {
      '@font-face': {
        ...interCommonFontFaceStyles,
        src: `url(${interMedium}) format('woff2')`,
        fontWeight: 500,
      },
    },
  ]);
}

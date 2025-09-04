import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getFontStyles(theme: GrafanaTheme2) {
  const grafanaPublicPath = typeof window !== 'undefined' && window.__grafana_public_path__;
  const fontRoot = grafanaPublicPath ? `${grafanaPublicPath}fonts/` : 'public/fonts/';

  return css([
    {
      /* latin */
      '@font-face': {
        fontFamily: 'Roboto Mono',
        fontStyle: 'normal',
        fontWeight: 400,
        fontDisplay: 'swap',
        src: `url('${fontRoot}roboto/L0xTDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vrtSM1J-gEPT5Ese6hmHSh0mQ.woff2') format('woff2')`,
        unicodeRange:
          'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
      },
    },
    {
      /* latin */
      '@font-face': {
        fontFamily: 'Roboto Mono',
        fontStyle: 'normal',
        fontWeight: 500,
        fontDisplay: 'swap',
        src: `url('${fontRoot}roboto/L0xTDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vrtSM1J-gEPT5Ese6hmHSh0mQ.woff2') format('woff2')`,
        unicodeRange:
          'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
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
        fontFamily: 'Inter',
        fontStyle: 'normal',
        fontWeight: 400,
        fontDisplay: 'swap',
        src: `url('${fontRoot}inter/Inter-Regular.woff2') format('woff2')`,
      },
    },
    {
      '@font-face': {
        fontFamily: 'Inter',
        fontStyle: 'normal',
        fontWeight: 500,
        fontDisplay: 'swap',
        src: `url('${fontRoot}inter/Inter-Medium.woff2') format('woff2')`,
      },
    },
    {
      '@font-face': {
        fontFamily: 'Inter',
        fontStyle: 'italic',
        fontWeight: 400,
        fontDisplay: 'swap',
        src: `url('${fontRoot}inter/Inter-Italic.woff2') format('woff2')`,
      },
    },
    {
      '@font-face': {
        fontFamily: 'Inter',
        fontStyle: 'italic',
        fontWeight: 500,
        fontDisplay: 'swap',
        src: `url('${fontRoot}inter/Inter-MediumItalic.woff2') format('woff2')`,
      },
    },
  ]);
}

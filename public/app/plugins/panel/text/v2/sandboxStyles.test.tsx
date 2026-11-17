import { render } from '@testing-library/react';

import { createTheme, ThemeContext } from '@grafana/data';
import { GlobalStyles } from '@grafana/ui';

import { getSandboxCss } from './sandboxStyles';

it.each(['light', 'dark'] as const)('keeps content styling while excluding app styles in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const { unmount } = render(
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
    </ThemeContext.Provider>
  );
  const sheets = Array.from(document.styleSheets);
  const appCss = sheets.flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText)).join('\n');
  // JSDOM does not expose CSSStyleSheet.ownerNode.
  document.querySelectorAll<HTMLStyleElement>('style[data-emotion]').forEach((style) => {
    if (style.sheet) {
      Object.defineProperty(style.sheet, 'ownerNode', { value: style });
    }
  });
  try {
    const css = getSandboxCss(theme);
    expect(css).toContain(`color: ${theme.colors.text.primary}`);
    expect(css).toContain(`font-family: ${theme.typography.fontFamily.replace(/,\s+/g, ',')}`);
    expect(css).toContain('.markdown-html table');
    expect(css).toContain('.markdown-html a:hover');
    expect(css).toContain('pre code');
    expect(css).toContain('.sr-only');
    expect(css).toContain('.btn-success,.btn-primary');
    expect(css).toContain('.text-center');
    expect(css).toContain('input,button,select,textarea');
    expect(css).toContain('@font-face');
    expect(css).toContain('Inter-Regular.woff2');
    expect(appCss).toContain('.page-container');
    expect(css).not.toContain('.page-container');
    expect(css.length).toBeLessThan(appCss.length);
    expect(Array.from(document.styleSheets)).toEqual(sheets);
  } finally {
    unmount();
  }
});

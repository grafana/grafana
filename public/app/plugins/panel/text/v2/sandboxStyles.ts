import createEmotion from '@emotion/css/create-instance';

import { type GrafanaTheme2 } from '@grafana/data';
import { getTextContentStyles } from '@grafana/ui/unstable';

import { getGlobalFontCss } from './sandboxPolicy';

const contentStyles = new WeakMap<GrafanaTheme2, string>();

export function getSandboxCss(theme: GrafanaTheme2): string {
  let css = contentStyles.get(theme);
  if (css === undefined) {
    // Compile through Emotion without applying styles or loading fonts in the parent document.
    const sheet = new CSSStyleSheet();
    const emotion = createEmotion({ key: 'text-content', container: document.createElement('div') });
    emotion.sheet.insert = (rule) => {
      try {
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch {
        // Match Emotion's handling of unsupported selectors and invalid legacy declarations.
      }
    };
    try {
      emotion.injectGlobal(getTextContentStyles(theme));
      css = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
      contentStyles.set(theme, css);
    } finally {
      emotion.flush();
    }
  }
  // Use the application's configured fonts, including custom branding fonts.
  return `${css}\n${getGlobalFontCss()}`;
}

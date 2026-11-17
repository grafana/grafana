import { type CodeMirrorThemeOverrides } from './types';

/**
 * Whether `theme` is plain style overrides. CodeMirror extensions, from any copy
 * of CodeMirror, are arrays or objects exposing an `extension` property.
 */
export function isThemeOverrides(theme: unknown): theme is CodeMirrorThemeOverrides {
  return typeof theme === 'object' && theme !== null && !Array.isArray(theme) && !('extension' in theme);
}

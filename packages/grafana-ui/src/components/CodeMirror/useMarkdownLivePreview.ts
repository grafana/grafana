import { useMemo } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import { markdownLivePreview } from './markdownLivePreview';
import { type CodeMirrorExtension } from './types';
import { useStableCallback } from './useStableProps';

/**
 * Memoized {@link markdownLivePreview} extension, ready to pass to
 * `CodeEditor`'s `extensions` prop.
 *
 * `CodeEditor` compares that array element-wise by identity, so an unmemoized
 * extension reconfigures the editor on every keystroke — which discards
 * extension state such as an open completion popup. `interpolate` may therefore
 * be a fresh closure each render; it is held by reference and always called at
 * its latest version.
 */
export function useMarkdownLivePreview(
  enabled = true,
  interpolate: (text: string) => string = (text) => text
): CodeMirrorExtension[] {
  const theme = useTheme2();
  const stableInterpolate = useStableCallback(interpolate);

  return useMemo(
    () => (enabled ? [markdownLivePreview(theme, stableInterpolate)] : []),
    [enabled, theme, stableInterpolate]
  );
}

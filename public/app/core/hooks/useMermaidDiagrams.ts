import { type RefObject, useEffect } from 'react';

import { useTheme2 } from '@grafana/ui';
import { renderMermaidDiagrams } from 'app/core/utils/mermaid';

/**
 * Turns the ```mermaid fences and <pre class="mermaid"> blocks inside `ref` into
 * themed diagrams. Pass the html that was injected so a content change redraws.
 */
export function useMermaidDiagrams(ref: RefObject<HTMLElement | null>, html: string, enabled = true) {
  const theme = useTheme2();

  // Runs after DangerouslySetHtmlContent's own effect (children first), so the
  // fences are in the DOM by then. mermaid.initialize is global, so a theme
  // flip redraws too.
  useEffect(() => {
    const container = ref.current;
    if (!enabled || !container) {
      return;
    }

    // Never rejects: import and per-diagram failures are reported in place.
    const controller = new AbortController();
    void renderMermaidDiagrams(container, theme, controller.signal);

    return () => controller.abort();
  }, [ref, html, enabled, theme]);
}

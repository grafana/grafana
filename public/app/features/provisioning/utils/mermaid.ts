import { type Mermaid } from 'mermaid';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

/** Selector for the fenced code blocks marked as mermaid by `marked` (```mermaid). */
export const MERMAID_CODE_SELECTOR = 'code.language-mermaid';

/** Class applied to the container that replaces a rendered mermaid code block. */
export const MERMAID_DIAGRAM_CLASS = 'markdown-mermaid';
export const MERMAID_ERROR_CLASS = 'markdown-mermaid-error';

interface RenderOptions {
  /** Use mermaid's dark theme to match Grafana's dark mode. */
  isDark: boolean;
  /** Cleared to true when the caller no longer wants the DOM mutated (e.g. React cleanup). */
  signal?: { cancelled: boolean };
}

// Mermaid is a large dependency, so it's only pulled in (as its own chunk) the
// first time a README actually contains a mermaid diagram.
let mermaidPromise: Promise<Mermaid> | undefined;

function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default);
    // Don't cache a rejected import: a transient chunk-load failure would
    // otherwise poison the cache and flag every diagram until a full reload.
    mermaidPromise.catch(() => {
      mermaidPromise = undefined;
    });
  }
  return mermaidPromise;
}

// mermaid.render() needs a unique, DOM-id-safe identifier per call; a
// monotonic counter avoids collisions across re-renders and multiple diagrams.
let diagramCounter = 0;

/** Leaves the original source visible but flags it so one bad diagram doesn't hide the README. */
function flagError(target: Element, signal?: { cancelled: boolean }) {
  if (!signal?.cancelled && target.isConnected) {
    target.classList.add(MERMAID_ERROR_CLASS);
    if (target instanceof HTMLElement) {
      // Hint that this block was meant to be a diagram, not an ordinary code block.
      target.title = t('browse-dashboards.readme.mermaid-error', "Couldn't render mermaid diagram");
    }
  }
}

/**
 * Finds mermaid fenced code blocks already rendered into `container` and
 * replaces each with its diagram. No-op (and no mermaid import) when the
 * container has no mermaid blocks.
 *
 * The README source is untrusted, so the rendered SVG is passed through
 * Grafana's SVG sanitizer before injection. `htmlLabels: false` keeps mermaid
 * from emitting `<foreignObject>` labels (which the sanitizer would strip),
 * rendering labels as plain SVG text instead. `securityLevel: 'strict'` is an
 * additional layer, not the only one.
 */
export async function renderMermaidDiagrams(container: HTMLElement, { isDark, signal }: RenderOptions): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR));
  if (blocks.length === 0) {
    return;
  }

  let mermaid: Mermaid;
  try {
    mermaid = await loadMermaid();
    if (signal?.cancelled) {
      return;
    }
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default',
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      // We render our own error UI; don't let mermaid inject its "bomb" diagram.
      suppressErrorRendering: true,
    });
  } catch {
    // A chunk-load or init failure shouldn't leave the blocks silently unrendered.
    blocks.forEach((code) => flagError(code.closest('pre') ?? code, signal));
    return;
  }

  for (const code of blocks) {
    if (signal?.cancelled) {
      return;
    }
    // The rendered <pre><code> wrapper is what we replace with the diagram.
    const target = code.closest('pre') ?? code;
    const source = code.textContent ?? '';
    const id = `readme-mermaid-${diagramCounter++}`;

    try {
      const { svg } = await mermaid.render(id, source);
      if (signal?.cancelled || !target.isConnected) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = MERMAID_DIAGRAM_CLASS;
      wrapper.innerHTML = textUtil.sanitizeSVGContent(svg);
      target.replaceWith(wrapper);
    } catch {
      flagError(target, signal);
    }
  }
}

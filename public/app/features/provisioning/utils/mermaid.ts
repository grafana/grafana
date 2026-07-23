import { type Mermaid } from 'mermaid';

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
  }
  return mermaidPromise;
}

// mermaid.render() needs a unique, DOM-id-safe identifier per call; a
// monotonic counter avoids collisions across re-renders and multiple diagrams.
let diagramCounter = 0;

/**
 * Finds mermaid fenced code blocks already rendered into `container` and
 * replaces each with its diagram. No-op (and no mermaid import) when the
 * container has no mermaid blocks.
 *
 * `securityLevel: 'strict'` makes mermaid sanitize its own SVG output and
 * disable interactivity, so the injected markup is safe despite bypassing the
 * README's outer sanitizer.
 */
export async function renderMermaidDiagrams(container: HTMLElement, { isDark, signal }: RenderOptions): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR));
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();
  if (signal?.cancelled) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: isDark ? 'dark' : 'default',
    // We render our own error UI; don't let mermaid inject its "bomb" diagram.
    suppressErrorRendering: true,
  });

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
      wrapper.innerHTML = svg;
      target.replaceWith(wrapper);
    } catch {
      // Leave the original source visible and flag it so a typo in one diagram
      // doesn't hide the rest of the README.
      if (!signal?.cancelled && target.isConnected) {
        target.classList.add(MERMAID_ERROR_CLASS);
      }
    }
  }
}

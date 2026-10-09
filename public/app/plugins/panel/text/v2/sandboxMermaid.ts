import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

import type { RenderCommand } from './sandboxProtocol';

export type RenderDiagrams = (
  command: RenderCommand,
  container: HTMLElement,
  isCancelled: () => boolean
) => Promise<void>;

const renderDiagrams: RenderDiagrams = async (command, container, isCancelled) => {
  if (!command.mermaid) {
    return;
  }
  mermaid.initialize({
    ...command.mermaid,
    securityLevel: 'strict',
    startOnLoad: false,
    htmlLabels: false,
    flowchart: { ...command.mermaid.flowchart, htmlLabels: false },
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'maxTextSize',
      'maxEdges',
      'suppressErrorRendering',
      'htmlLabels',
      'flowchart',
    ],
    suppressErrorRendering: true,
  });
  let id = 0;
  for (const block of container.querySelectorAll('code.language-mermaid, pre.mermaid')) {
    if (isCancelled()) {
      return;
    }
    const target = block.tagName === 'CODE' ? block.parentElement! : block;
    try {
      const result = await mermaid.render(`text-mermaid-${++id}`, target.textContent ?? '');
      if (isCancelled()) {
        return;
      }
      const diagram = document.createElement('div');
      diagram.className = 'mermaid-diagram';
      diagram.innerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      target.replaceWith(diagram);
    } catch {
      // CSP failures can reject image decoding too; the runtime reports those independently.
      if (!isCancelled()) {
        const error = document.createElement('div');
        error.className = 'mermaid-diagram-error';
        error.setAttribute('role', 'status');
        error.textContent = command.diagramError;
        target.before(error);
      }
    }
  }
};

const bootstrap = document.currentScript;
if (bootstrap && 'registerMermaid' in bootstrap && typeof bootstrap.registerMermaid === 'function') {
  bootstrap.registerMermaid(renderDiagrams);
}

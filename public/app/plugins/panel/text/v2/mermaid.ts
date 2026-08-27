import type { Mermaid, MermaidConfig } from 'mermaid';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

const MERMAID_SELECTOR = 'code.language-mermaid, pre.mermaid';

export const DIAGRAM_CLASS = 'textng-mermaid';
export const DIAGRAM_ERROR_CLASS = 'textng-mermaid-error';

// Render ids have to be unique document-wide, not just per panel.
let diagramSeq = 0;

export async function renderMermaidDiagrams(container: HTMLElement, theme: GrafanaTheme2, signal: AbortSignal) {
  // Not cached: the flag value can change after the providers settle.
  if (!getFeatureFlagClient().getBooleanValue('text.newFeatures', false)) {
    return;
  }

  const diagrams = Array.from(container.querySelectorAll(MERMAID_SELECTOR), (block) => ({
    // textContent un-escapes marked's `--&gt;` back to `-->` for free.
    source: block.textContent ?? '',
    // A fence keeps the source in the <code>, but the <pre> is what gets replaced.
    target: block.tagName === 'CODE' ? (block.parentElement ?? block) : block,
  }));

  if (diagrams.length === 0) {
    return;
  }

  let mermaid: Mermaid;
  try {
    ({ default: mermaid } = await import(/* webpackChunkName: "mermaid" */ 'mermaid'));
    mermaid.initialize(getMermaidConfig(theme));
  } catch (error) {
    diagrams.forEach(({ target }) => markFailed(target, asError(error)));
    return;
  }

  for (const { source, target } of diagrams) {
    const result = await renderDiagram(mermaid, source);
    if (signal.aborted) {
      return;
    }

    if (typeof result === 'string') {
      const diagram = document.createElement('div');
      diagram.className = DIAGRAM_CLASS;
      diagram.innerHTML = textUtil.sanitizeSVGContent(result);
      target.replaceWith(diagram);
    } else {
      markFailed(target, result);
    }
  }
}

async function renderDiagram(mermaid: Mermaid, source: string): Promise<string | Error> {
  try {
    // suppressErrors so a syntax error is a false, not a throw that leaves
    // mermaid's own unthemed error graphic behind.
    if (!(await mermaid.parse(source, { suppressErrors: true }))) {
      return new Error(t('textng.mermaid.invalid-syntax', 'invalid diagram syntax'));
    }
    const { svg } = await mermaid.render(`textng-mermaid-${++diagramSeq}`, source);
    return svg;
  } catch (error) {
    return asError(error);
  }
}

function markFailed(target: Element, error: Error) {
  const message = document.createElement('div');
  message.className = DIAGRAM_ERROR_CLASS;
  message.textContent = t('textng.mermaid.render-error', 'Diagram error: {{message}}', { message: error.message });
  target.insertAdjacentElement('beforebegin', message);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getMermaidConfig(theme: GrafanaTheme2): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    // sanitizeSVGContent drops <foreignObject>, where mermaid puts HTML labels,
    // so the shapes would survive with no text in them.
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true },
    theme: 'base',
    fontFamily: theme.typography.fontFamily,
    themeVariables: {
      darkMode: theme.isDark,
      background: theme.colors.background.primary,
      mainBkg: theme.colors.background.secondary,
      primaryColor: theme.colors.background.secondary,
      primaryTextColor: theme.colors.text.primary,
      primaryBorderColor: theme.colors.border.medium,
      secondaryColor: theme.colors.background.canvas,
      tertiaryColor: theme.colors.background.elevated,
      lineColor: theme.colors.border.strong,
      textColor: theme.colors.text.primary,
      titleColor: theme.colors.text.maxContrast,
      nodeBorder: theme.colors.border.medium,
      clusterBkg: theme.colors.background.canvas,
      clusterBorder: theme.colors.border.weak,
      edgeLabelBackground: theme.colors.background.primary,
      fontSize: `${theme.typography.fontSize}px`,
    },
  };
}

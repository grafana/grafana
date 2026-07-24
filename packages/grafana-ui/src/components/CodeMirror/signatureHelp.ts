import { StateField, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view';

import { type GrafanaTheme2 } from '@grafana/data';

import { type SignatureHelp, type SignatureHelpProvider, type SignatureInformation } from './types';

export interface SignatureHelpOptions {
  /**
   * Grafana theme used to style the tooltip. When omitted the tooltip falls
   * back to CodeMirror's default tooltip chrome plus the structural base styles.
   */
  theme?: GrafanaTheme2;
}

interface SignatureHelpState {
  help: SignatureHelp;
  pos: number;
}

/**
 * Builds a CodeMirror extension that shows a signature-help tooltip while the
 * cursor sits inside a function call. The provider owns language-specific
 * detection; this extension owns the state tracking and tooltip rendering.
 */
export function signatureHelp(provider: SignatureHelpProvider, options: SignatureHelpOptions = {}): Extension {
  const field = StateField.define<SignatureHelpState | null>({
    create(state) {
      const pos = state.selection.main.head;
      return toState(provider(state, pos), pos);
    },
    update(value, tr) {
      // Only recompute when the document or selection changes; other transactions
      // (for example focus or config changes) leave the signature untouched.
      if (!tr.docChanged && !tr.selection) {
        return value;
      }

      const pos = tr.state.selection.main.head;
      return toState(provider(tr.state, pos), pos);
    },
    provide: (stateField) =>
      showTooltip.from(stateField, (value) => (value ? createSignatureTooltip(value.help, value.pos) : null)),
  });

  const extensions: Extension[] = [field, baseTheme];

  if (options.theme) {
    extensions.push(getSignatureHelpTheme(options.theme));
  }

  return extensions;
}

// Treat help without any signatures as "no help" so the tooltip is never created
// with an empty signature list (which would otherwise fail to render).
function toState(help: SignatureHelp | null, pos: number): SignatureHelpState | null {
  return help?.signatures.length ? { help, pos } : null;
}

function createSignatureTooltip(help: SignatureHelp, pos: number): Tooltip {
  const signature = help.signatures[help.activeSignature] ?? help.signatures[0];

  return {
    pos,
    above: true,
    strictSide: false,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-signature-help';
      dom.appendChild(renderSignature(signature, help.activeParameter));

      if (signature.documentation) {
        const doc = document.createElement('div');
        doc.className = 'cm-signature-help-doc';
        doc.textContent = signature.documentation;
        dom.appendChild(doc);
      }

      return { dom };
    },
  };
}

function renderSignature(signature: SignatureInformation, activeParameter: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cm-signature-help-label';

  container.appendChild(document.createTextNode(`${signature.name}(`));

  signature.parameters.forEach((parameter, index) => {
    if (index > 0) {
      container.appendChild(document.createTextNode(', '));
    }

    const paramEl = document.createElement('span');
    paramEl.textContent = parameter.label;

    if (index === activeParameter) {
      paramEl.className = 'cm-signature-help-active-param';
    }

    container.appendChild(paramEl);
  });

  container.appendChild(document.createTextNode(')'));

  if (signature.returnType) {
    container.appendChild(document.createTextNode(`: ${signature.returnType}`));
  }

  return container;
}

// Structural styles that apply regardless of theme. Colors are layered on top by
// getSignatureHelpTheme when a Grafana theme is provided.
const baseTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-signature-help': {
    padding: '6px 10px',
    maxWidth: '480px',
    borderRadius: '2px',
  },
  '.cm-signature-help-label': {
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-signature-help-active-param': {
    fontWeight: 'bold',
  },
  '.cm-signature-help-doc': {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid rgba(127, 127, 127, 0.3)',
  },
});

/**
 * Applies Grafana theme tokens to the tooltip so it matches the surrounding UI
 * in both light and dark modes, VSCode signature-help style.
 */
function getSignatureHelpTheme(theme: GrafanaTheme2): Extension {
  return EditorView.theme({
    '.cm-tooltip.cm-signature-help': {
      padding: theme.spacing(0.75, 1.25),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.elevated,
      color: theme.colors.text.primary,
      boxShadow: theme.shadows.z2,
      fontSize: theme.typography.bodySmall.fontSize,
    },
    '.cm-signature-help-label': {
      fontFamily: theme.typography.fontFamilyMonospace,
      lineHeight: theme.typography.bodySmall.lineHeight,
    },
    '.cm-signature-help-active-param': {
      color: theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightBold,
    },
    '.cm-signature-help-doc': {
      marginTop: theme.spacing(0.75),
      paddingTop: theme.spacing(0.75),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
    },
  });
}

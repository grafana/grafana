import { ViewPlugin } from '@codemirror/view';

import { type CodeMirrorExtension } from '@grafana/ui/unstable';

/**
 * Builds a fresh extension that moves focus into a CodeMirror editor after its
 * view has been attached to the DOM.
 */
export function buildCodeCellFocusExtension(): CodeMirrorExtension[] {
  return [
    ViewPlugin.define((view) => {
      requestAnimationFrame(() => view.focus());
      return {};
    }),
  ];
}

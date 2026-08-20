import { type CodeMirrorExtension, type SignatureHelpOptions, type SignatureHelpProvider } from './types';

export type { SignatureHelpOptions } from './types';

/**
 * Builds a CodeMirror extension that shows a signature-help tooltip while the
 * cursor sits inside a function call. The provider owns language-specific
 * detection; this extension owns the state tracking and tooltip rendering.
 */
export function signatureHelp(
  provider: SignatureHelpProvider,
  options: SignatureHelpOptions = {}
): CodeMirrorExtension {
  return import(/* webpackChunkName: "react-codemirror-signature-help" */ './signatureHelpExtension').then((module) =>
    module.createSignatureHelpExtension(provider, options)
  );
}

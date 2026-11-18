import { type CompletionResult, type CompletionSource } from '@codemirror/autocomplete';
import { type EditorState } from '@codemirror/state';

import {
  type CodeMirrorCompletionResult,
  type CodeMirrorCompletionSource,
  type CodeMirrorProviderContext,
  type NativeSignatureHelpProvider,
  type SignatureHelpProvider,
} from './types';

function createProviderContext(state: EditorState, pos: number): CodeMirrorProviderContext {
  return {
    pos,
    sliceDoc: (from, to) => state.sliceDoc(from, to),
  };
}

function toCompletionResult(result: CodeMirrorCompletionResult): CompletionResult {
  return {
    from: result.from,
    to: result.to,
    options: result.options.map(({ label, insertText, detail, info, type, boost }) => ({
      label,
      apply: typeof insertText === 'string' ? insertText : undefined,
      detail,
      info: typeof info === 'string' ? info : undefined,
      type,
      boost,
    })),
    filter: result.filter,
    validFor: result.filter !== false && result.validFor instanceof RegExp ? result.validFor : undefined,
  };
}

export function adaptCompletionSource(source: CodeMirrorCompletionSource): CompletionSource {
  return async (context) => {
    if (context.aborted) {
      return null;
    }

    const controller = new AbortController();
    context.addEventListener('abort', () => controller.abort());

    try {
      const result = await source({
        ...createProviderContext(context.state, context.pos),
        explicit: context.explicit,
        signal: controller.signal,
        matchBefore: (pattern) => context.matchBefore(pattern),
      });
      return result && !controller.signal.aborted ? toCompletionResult(result) : null;
    } catch (error) {
      if (controller.signal.aborted) {
        return null;
      }
      throw error;
    }
  };
}

export function adaptSignatureHelp(provider: SignatureHelpProvider): NativeSignatureHelpProvider {
  return (state, pos) => provider(createProviderContext(state, pos));
}

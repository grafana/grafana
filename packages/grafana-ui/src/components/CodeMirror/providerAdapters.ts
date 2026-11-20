import { type CompletionResult, type CompletionSource } from '@codemirror/autocomplete';
import { highlightingFor } from '@codemirror/language';
import { type EditorState, type Range } from '@codemirror/state';
import { Decoration, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type Tag, tags } from '@lezer/highlight';

import {
  type CodeMirrorCompletionResult,
  type CodeMirrorCompletionSource,
  type CodeMirrorHighlightProvider,
  type CodeMirrorHighlightRange,
  type CodeMirrorProviderContext,
  type NativeSignatureHelpProvider,
  type SignatureHelpProvider,
} from './types';

const highlightTags = new Map<CodeMirrorHighlightRange['kind'], Tag>([
  ['keyword', tags.keyword],
  ['identifier', tags.variableName],
  ['property', tags.propertyName],
  ['function', tags.function(tags.variableName)],
  ['string', tags.string],
  ['number', tags.number],
  ['boolean', tags.bool],
  ['operator', tags.operator],
  ['punctuation', tags.punctuation],
  ['comment', tags.comment],
]);

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

export function adaptSyntaxHighlighting(provider: CodeMirrorHighlightProvider) {
  function buildDecorations(state: EditorState) {
    const decorations: Array<Range<Decoration>> = [];
    for (const { from, to, kind } of provider(state.doc.toString())) {
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to || to > state.doc.length) {
        continue;
      }
      const tag = highlightTags.get(kind);
      const className = tag && highlightingFor(state, [tag]);
      if (className) {
        decorations.push(Decoration.mark({ class: className }).range(from, to));
      }
    }
    return Decoration.set(decorations, true);
  }

  return ViewPlugin.define(
    (view) => ({
      decorations: buildDecorations(view.state),
      update(update: ViewUpdate) {
        // A theme reconfiguration can change the highlight classes without an edit.
        if (update.docChanged || update.transactions.some((transaction) => transaction.reconfigured)) {
          this.decorations = buildDecorations(update.state);
        }
      },
    }),
    { decorations: (plugin) => plugin.decorations }
  );
}

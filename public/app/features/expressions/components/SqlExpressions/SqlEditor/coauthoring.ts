import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import {
  isQueryCoauthoringEditorHost,
  type QueryCoauthoringEditorHost,
  type QueryCoauthoringTextChange,
} from 'app/features/dashboard-scene/panel-edit/PanelEditNext/QueryEditor/coauthoring/queryCoauthoringContracts';

const setChanges = StateEffect.define<QueryCoauthoringTextChange[] | null>();

export function coauthoringExtensions(host: QueryCoauthoringEditorHost | undefined, tint: string) {
  if (!isQueryCoauthoringEditorHost(host)) {
    return [];
  }
  const editorHost = host;
  const marks = StateField.define<{ changes: QueryCoauthoringTextChange[] | null; decorations: DecorationSet }>({
    create: () => ({ changes: null, decorations: Decoration.none }),
    update(value, transaction) {
      let changes = value.changes;
      for (const effect of transaction.effects) {
        if (effect.is(setChanges)) {
          changes = effect.value;
        }
      }
      if (!transaction.docChanged && !transaction.effects.some((effect) => effect.is(setChanges))) {
        return value;
      }
      const text = transaction.state.doc.toString();
      if (transaction.docChanged && !changes?.some((change) => text === change.original || text === change.proposed)) {
        changes = null;
      }
      const lines = new Set<number>();
      for (const change of changes ?? []) {
        for (const range of text === change.proposed ? change.proposedRanges : change.originalRanges) {
          const from = transaction.state.doc.lineAt(Math.min(text.length, range.from)).number;
          const to = transaction.state.doc.lineAt(Math.min(text.length, Math.max(range.from, range.to - 1))).number;
          for (let line = from; line <= to; line++) {
            lines.add(line);
          }
        }
      }
      return {
        changes,
        decorations: Decoration.set(
          [...lines]
            .sort((a, b) => a - b)
            .map((line) =>
              Decoration.line({ attributes: { style: `background-color: ${tint}` } }).range(
                transaction.state.doc.line(line).from
              )
            )
        ),
      };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
  return [
    marks,
    keymap.of([
      {
        key: 'Mod-.',
        run() {
          editorHost.invoke();
          return true;
        },
      },
    ]),
    ViewPlugin.fromClass(
      class {
        private listeners = new Set<() => void>();
        private stop: () => void;
        private active = true;
        constructor(view: EditorView) {
          this.stop = editorHost.register({
            version: 1,
            getSelection: () => {
              const ranges = view.state.selection.ranges
                .filter((range) => !range.empty)
                .map(({ from, to }) => ({ from, to }));
              return ranges.length ? { ranges, anchor: view.contentDOM } : null;
            },
            subscribe: (listener) => {
              this.listeners.add(listener);
              return () => {
                this.listeners.delete(listener);
              };
            },
            // Core can request marks synchronously from register, before the view finishes creating plugins.
            showChanges: (changes) => {
              queueMicrotask(() => {
                if (this.active) {
                  view.dispatch({ effects: setChanges.of(changes) });
                }
              });
            },
          });
        }
        update(update: ViewUpdate) {
          if (update.selectionSet || update.docChanged || update.viewportChanged) {
            this.listeners.forEach((listener) => listener());
          }
        }
        destroy() {
          this.active = false;
          this.stop();
          this.listeners.clear();
        }
      }
    ),
  ];
}

import { Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { SyntaxHighlightConfig } from './types';

/**
 * Creates a generic syntax highlighter based on a pattern and class name
 */
export function createGenericHighlighter(config: SyntaxHighlightConfig): Extension {
  const { pattern, className } = config;

  const decoration = Decoration.mark({
    class: className,
  });

  const viewPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations: Array<{ from: number; to: number }> = [];
        const text = view.state.doc.toString();
        let match;

        // Reset regex state
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          decorations.push({
            from: match.index,
            to: match.index + match[0].length,
          });
        }

        return Decoration.set(decorations.map((range) => decoration.range(range.from, range.to)));
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return viewPlugin;
}

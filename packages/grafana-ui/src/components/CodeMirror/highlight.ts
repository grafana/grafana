import { Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { SyntaxHighlightConfig } from './types';

/**
 * Creates a generic syntax highlighter for a given pattern/className pair.
 *
 * Uses ViewPlugin (not MatchDecorator) so we can explicitly reset lastIndex
 * on every build, avoiding stale regex state with global /g flags.
 */
export function createGenericHighlighter(config: SyntaxHighlightConfig): Extension {
  const decoration = Decoration.mark({ class: config.className });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const text = view.state.doc.toString();
        const ranges: Array<ReturnType<typeof decoration.range>> = [];

        // CRITICAL: reset global regex before each scan
        config.pattern.lastIndex = 0;

        let match;
        while ((match = config.pattern.exec(text)) !== null) {
          ranges.push(decoration.range(match.index, match.index + match[0].length));
        }

        return Decoration.set(ranges);
      }
    },
    { decorations: (v) => v.decorations }
  );
}

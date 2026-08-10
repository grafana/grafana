import { syntaxTree } from '@codemirror/language';
import { Prec, type EditorState, type Extension, type Line, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
  type PluginValue,
} from '@codemirror/view';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Node names are matched as strings rather than against `@lezer/markdown`'s
 * `Type` enum: that package is only a transitive dependency of `@grafana/ui`
 * (`@codemirror/lang-markdown` owns it), and importing it here would also pull
 * the lazily-chunked markdown grammar into the main bundle.
 */

/** Markers replaced with nothing while the cursor is off their line. */
const HIDDEN_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark', 'QuoteMark']);

/**
 * Markers hidden only inside this parent. A fenced block's ``` fence is a
 * `CodeMark` too, and hiding it would leave a blank line where the block starts;
 * an autolink's `URL` is the only text it has, so hiding it would leave nothing.
 *
 * Images are excluded throughout: nothing here renders one, so hiding `![…](…)`
 * would collapse it to bare alt text and the image would silently disappear.
 * Showing the source at least tells the author an image is there.
 */
const HIDDEN_MARK_PARENTS = new Map([
  ['CodeMark', 'InlineCode'],
  ['LinkMark', 'Link'],
  ['LinkTitle', 'Link'],
  ['URL', 'Link'],
]);

/** Block nodes that style every line they cover. */
const LINE_CLASSES: Record<string, string> = {
  ATXHeading1: 'cm-md-h1',
  SetextHeading1: 'cm-md-h1',
  ATXHeading2: 'cm-md-h2',
  SetextHeading2: 'cm-md-h2',
  ATXHeading3: 'cm-md-h3',
  ATXHeading4: 'cm-md-h4',
  ATXHeading5: 'cm-md-h5',
  ATXHeading6: 'cm-md-h6',
  Blockquote: 'cm-md-quote',
  FencedCode: 'cm-md-code',
  CodeBlock: 'cm-md-code',
};

const LINE_DECORATIONS: Record<string, Decoration> = Object.fromEntries(
  Object.entries(LINE_CLASSES).map(([node, className]) => {
    // The `#` markers are hidden from the DOM, and a `cm-line` div carries no
    // semantics of its own, so the heading is announced from the line instead.
    const level = /Heading(\d)$/.exec(node)?.[1];
    return [
      node,
      Decoration.line(
        level ? { class: className, attributes: { role: 'heading', 'aria-level': level } } : { class: className }
      ),
    ];
  })
);

/**
 * A select-all would otherwise un-render the whole document at once — a full
 * reflow, and a flash of raw markdown. Past this many lines only the line the
 * cursor sits on is revealed.
 */
const MAX_REVEALED_LINES = 50;

const hidden = Decoration.replace({});

/** Line numbers whose markers stay visible because a selection touches them. */
function revealedLines(state: EditorState): Set<number> {
  const lines = new Set<number>();

  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;

    if (last - first > MAX_REVEALED_LINES) {
      lines.add(state.doc.lineAt(range.head).number);
      continue;
    }

    for (let line = first; line <= last; line++) {
      lines.add(line);
    }
  }

  return lines;
}

/** Identifies a revealed-line set, so caret motion within a line is not a change. */
const revealedKey = (state: EditorState) => [...revealedLines(state)].join(',');

/**
 * `ATXHeading` writes `HeaderMark` over the `#` run alone and starts the inline
 * content one character later, so the separating space belongs to no node. Left
 * behind, every heading renders with a stray leading space.
 */
function markerEnd(state: EditorState, name: string, from: number, to: number): number {
  if (name !== 'HeaderMark' && name !== 'QuoteMark') {
    return to;
  }

  const lineEnd = state.doc.lineAt(from).to;
  let end = to;
  while (end < lineEnd && state.doc.sliceString(end, end + 1) === ' ') {
    end++;
  }
  return end;
}

/**
 * A template or field variable reference: `$name`, `${name}`, `${name:format}`
 * or `[[name]]`. Deliberately loose — a match that interpolates to itself (`$5`
 * in prose, an undefined variable) is discarded rather than filtered up front.
 *
 * `DataLinks/codemirrorUtils.ts` has a deliberately narrower `${…}`-only
 * pattern for highlighting; the two are not meant to be unified.
 */
const VARIABLE_PATTERN = /\$\{[^}\s]+\}|\[\[[^\]\s]+\]\]|\$\w+/g;

class VariableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly value: string
  ) {
    super();
  }

  // Without this every widget is rebuilt on every keystroke and cursor move.
  eq(other: VariableWidget) {
    return other.source === this.source && other.value === this.value;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-variable';
    span.textContent = this.value;
    span.title = this.source;
    // The widget lives inside contenteditable; without this the browser lets the
    // user type into it and CodeMirror sees DOM it did not produce.
    span.setAttribute('contenteditable', 'false');
    return span;
  }

  // Let CodeMirror handle clicks so the caret can be placed next to the value.
  ignoreEvent() {
    return false;
  }
}

interface Span {
  from: number;
  to: number;
}

const contains = (outer: Span, inner: Span) => outer.from <= inner.from && outer.to >= inner.to;
const overlaps = (a: Span, b: Span) => a.from < b.to && a.to > b.from;

interface VariableSpan extends Span {
  source: string;
  value: string;
}

/** Resolvable variable references on `line`. */
function findVariables(line: Line, resolve: (text: string) => string): VariableSpan[] {
  // Most prose lines hold neither, and the regex is by far the costlier check.
  if (!line.text.includes('$') && !line.text.includes('[[')) {
    return [];
  }

  const found: VariableSpan[] = [];

  for (const match of line.text.matchAll(VARIABLE_PATTERN)) {
    const source = match[0];
    const value = resolve(source);

    // Unchanged means it is not a variable at all, or has no value to show.
    if (value !== source) {
      const from = line.from + (match.index ?? 0);
      found.push({ from, to: from + source.length, source, value });
    }
  }

  return found;
}

function buildLivePreviewDecorations(view: EditorView, interpolate?: (text: string) => string): DecorationSet {
  const { state } = view;
  const tree = syntaxTree(state);
  const revealed = revealedLines(state);
  // Resolution walks the scene graph, and prose repeats references (and pays for
  // near-misses like `$5`), so each distinct token is resolved once per build.
  const resolved = new Map<string, string>();
  const resolve = (source: string) => {
    let value = resolved.get(source);
    if (value === undefined) {
      value = interpolate ? interpolate(source) : source;
      resolved.set(source, value);
    }
    return value;
  };
  // Not a RangeSetBuilder: line decorations sit at line starts and interleave
  // with marks found later in the tree walk, so positions do not arrive sorted.
  const ranges: Array<Range<Decoration>> = [];
  const decoratedLines = new Set<string>();
  // Collected rather than emitted, because a variable reference can overlap a
  // marker and only one of the two may claim the range.
  const markers: Span[] = [];
  const variables: VariableSpan[] = [];

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const lineDecoration = LINE_DECORATIONS[node.name];

        if (lineDecoration) {
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(Math.min(node.to, state.doc.length)).number;
          for (let line = first; line <= last; line++) {
            // Nested blockquotes cover the same lines twice.
            const key = `${node.name}:${line}`;
            if (!decoratedLines.has(key)) {
              decoratedLines.add(key);
              ranges.push(lineDecoration.range(state.doc.line(line).from));
            }
          }
          return;
        }

        const requiredParent = HIDDEN_MARK_PARENTS.get(node.name);
        const hideable = requiredParent ? node.node.parent?.name === requiredParent : HIDDEN_MARKS.has(node.name);
        if (!hideable || revealed.has(state.doc.lineAt(node.from).number)) {
          return;
        }

        const end = markerEnd(state, node.name, node.from, node.to);
        if (end > node.from) {
          markers.push({ from: node.from, to: end });
        }
      },
    });

    if (interpolate) {
      const lastLine = state.doc.lineAt(to).number;
      for (let number = state.doc.lineAt(from).number; number <= lastLine; number++) {
        if (!revealed.has(number)) {
          variables.push(...findVariables(state.doc.line(number), resolve));
        }
      }
    }
  }

  // Interpolation runs before the markdown parser when the panel renders, so a
  // variable owns its whole reference — `[[name]]` is a variable, not a link.
  // A variable sitting *inside* a marker (a link URL) is the other way round.
  const keptMarkers = markers.filter((marker) => !variables.some((variable) => contains(variable, marker)));
  const keptVariables = variables.filter((variable) => !keptMarkers.some((marker) => overlaps(marker, variable)));

  for (const marker of keptMarkers) {
    ranges.push(hidden.range(marker.from, marker.to));
  }
  for (const { from, to, source, value } of keptVariables) {
    ranges.push(Decoration.replace({ widget: new VariableWidget(source, value) }).range(from, to));
  }

  return Decoration.set(ranges, true);
}

function livePreviewPlugin(interpolate?: (text: string) => string) {
  return ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet;
      private tree: ReturnType<typeof syntaxTree>;
      private revealed: string;

      constructor(view: EditorView) {
        this.tree = syntaxTree(view.state);
        this.revealed = revealedKey(view.state);
        this.decorations = buildLivePreviewDecorations(view, interpolate);
      }

      update(update: ViewUpdate) {
        // Replacing DOM inside an active composition aborts it in Chrome and Safari,
        // which drops or duplicates characters for IME users. The composition's own
        // final change triggers the rebuild instead.
        if (update.view.composing) {
          return;
        }

        // The parser advances the tree in a transaction that changes nothing else,
        // so tree identity has to be part of the condition or the tail of a long
        // document stays unstyled until the next edit. The selection only matters
        // through the lines it reveals, so caret motion within a line is ignored.
        const tree = syntaxTree(update.state);
        const revealed = revealedKey(update.state);
        const isStale = tree !== this.tree || revealed !== this.revealed || update.docChanged || update.viewportChanged;

        if (isStale) {
          this.tree = tree;
          this.revealed = revealed;
          this.decorations = buildLivePreviewDecorations(update.view, interpolate);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}

function livePreviewTheme(theme: GrafanaTheme2): Extension {
  // Takes its weight from the variant so a heading matches the real element
  // (see GlobalStyles/elements.ts); the margins there cannot apply to a line.
  const heading = (level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
    const variant = theme.typography[level];
    return {
      fontSize: variant.fontSize,
      lineHeight: `${variant.lineHeight}`,
      fontWeight: `${variant.fontWeight}`,
      color: theme.colors.text.primary,
    };
  };

  return EditorView.theme({
    // Prose, not code — but `padding` is deliberately left alone here, callers
    // set it on `.cm-content`/`.cm-line` from outside the editor.
    '.cm-content': {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.body.fontSize,
      lineHeight: `${theme.typography.body.lineHeight}`,
    },
    '.cm-md-h1': heading('h1'),
    '.cm-md-h2': heading('h2'),
    '.cm-md-h3': heading('h3'),
    '.cm-md-h4': heading('h4'),
    '.cm-md-h5': heading('h5'),
    '.cm-md-h6': heading('h6'),
    '.cm-md-quote': {
      borderLeft: `3px solid ${theme.colors.border.strong}`,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    },
    '.cm-md-code': {
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      background: theme.colors.background.secondary,
    },
    // Marked as interpolated so a resolved value is not mistaken for typed text.
    '.cm-md-variable': {
      color: theme.colors.text.primary,
      background: theme.colors.background.secondary,
      borderBottom: `1px dotted ${theme.colors.border.strong}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.25),
    },
  });
}

/**
 * Renders markdown formatting in place while the document stays markdown
 * source: headings take heading sizes, emphasis and links render, and the
 * syntax markers are hidden except on the line the cursor is on.
 *
 * Requires `language="markdown"`. The editor's value is never rewritten, so
 * commands that edit the source — and copy, undo and paste — are unaffected.
 *
 * The returned extension must be memoized. `CodeEditor` compares the
 * `extensions` array element-wise by identity, so a fresh call on every render
 * reconfigures the whole editor and closes any open completion popup. Prefer
 * {@link useMarkdownLivePreview}, which handles this.
 *
 * `interpolate` resolves a variable reference such as `${datacenter}` to its
 * value, which is shown in place of the reference; it should return its input
 * unchanged for anything that is not a variable. Values refresh on the next
 * edit, selection change or scroll — not the instant a dashboard variable
 * changes. Omit it to leave references as source.
 */
export function markdownLivePreview(theme: GrafanaTheme2, interpolate?: (text: string) => string): Extension {
  // Only the theme is raised: our class selectors already out-specify the
  // default syntax highlighting, and raising the plugin itself would nest our
  // replacements outside the highlight spans.
  return [livePreviewPlugin(interpolate), Prec.high(livePreviewTheme(theme))];
}

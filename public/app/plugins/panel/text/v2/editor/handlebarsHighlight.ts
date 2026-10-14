import { type Extension, Prec } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { type GrafanaTheme2 } from '@grafana/data';

import { HELPER_NAMES } from '../handlebars';

type HandlebarsTokenKind = 'delimiter' | 'keyword' | 'helper' | 'path' | 'string' | 'number' | 'comment';

interface HandlebarsToken {
  from: number;
  to: number;
  kind: HandlebarsTokenKind;
}

// Spans line breaks, and stops at the first closing braces.
const EXPRESSION = /(\\?)(\{\{\{?)([\s\S]*?)(\}\}\}?)/g;

// What it misses, like a half-typed expression, stays uncolored.
const INNER = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|[\w$@./[\]-]+|[()|=]/g;

const SIGIL = /^[#/^&>]/;

/** After these, the name is a block keyword like `if`, not a helper. */
const BLOCK_SIGIL = /^[#/^]/;

const BLOCK_KEYWORDS = new Set(['if', 'unless', 'each', 'with']);
const LITERALS = new Set(['true', 'false', 'null', 'undefined']);
const HELPERS = new Set(HELPER_NAMES);

const isString = (token: string) => token.startsWith('"') || token.startsWith("'");
const isPunctuation = (token: string) => /^[()|=]$/.test(token);

function classify(token: string, atHead: boolean, inBlock: boolean): HandlebarsTokenKind {
  if (isString(token)) {
    return 'string';
  }
  if (/^\d/.test(token) || LITERALS.has(token)) {
    return 'number';
  }
  if (isPunctuation(token)) {
    return 'delimiter';
  }
  // `{{else}}` has no `#` or `/`, so it is a keyword without one.
  if (atHead && (token === 'else' || (inBlock && BLOCK_KEYWORDS.has(token)))) {
    return 'keyword';
  }
  if (atHead && HELPERS.has(token)) {
    return 'helper';
  }
  return 'path';
}

/** A regex, not the Handlebars parser: the parser throws while an expression is half-typed. */
export function tokenizeHandlebars(text: string): HandlebarsToken[] {
  const tokens: HandlebarsToken[] = [];

  EXPRESSION.lastIndex = 0;
  let expression: RegExpExecArray | null;

  while ((expression = EXPRESSION.exec(text)) !== null) {
    const [match, escaped, open, body, close] = expression;

    // A backslash prints the braces instead, so this is not an expression.
    if (escaped) {
      continue;
    }

    const from = expression.index;
    const to = from + match.length;

    if (body.startsWith('!')) {
      tokens.push({ from, to, kind: 'comment' });
      continue;
    }

    tokens.push({ from, to: from + open.length, kind: 'delimiter' });
    tokens.push({ from: to - close.length, to, kind: 'delimiter' });

    const sigil = SIGIL.test(body) ? 1 : 0;
    if (sigil) {
      tokens.push({ from: from + open.length, to: from + open.length + sigil, kind: 'delimiter' });
    }

    const innerFrom = from + open.length + sigil;
    let inBlock = BLOCK_SIGIL.test(body);
    // The first name in the body, or after a `(`, is the one being called.
    let atHead = true;

    const afterSigil = body.slice(sigil);
    INNER.lastIndex = 0;
    let inner: RegExpExecArray | null;

    while ((inner = INNER.exec(afterSigil)) !== null) {
      const token = inner[0];
      const kind = classify(token, atHead, inBlock);

      tokens.push({ from: innerFrom + inner.index, to: innerFrom + inner.index + token.length, kind });

      // `{{else if x}}` keeps `if` both a block keyword and the name being called.
      const chainsElse = kind === 'keyword' && token === 'else';
      inBlock = inBlock || chainsElse;
      atHead = chainsElse || token === '(';
    }
  }

  return tokens;
}

const className = (kind: HandlebarsTokenKind) => `cm-handlebars-${kind}`;

const MARK: Record<HandlebarsTokenKind, Decoration> = {
  delimiter: Decoration.mark({ class: className('delimiter') }),
  keyword: Decoration.mark({ class: className('keyword') }),
  helper: Decoration.mark({ class: className('helper') }),
  path: Decoration.mark({ class: className('path') }),
  string: Decoration.mark({ class: className('string') }),
  number: Decoration.mark({ class: className('number') }),
  comment: Decoration.mark({ class: className('comment') }),
};

export function buildHandlebarsDecorations(text: string): DecorationSet {
  const ranges = tokenizeHandlebars(text).map(({ from, to, kind }) => MARK[kind].range(from, to));

  // Tokens come out of order, closing braces first, so let the set sort them.
  return Decoration.set(ranges, true);
}

/** Highlights `{{...}}` on top of the editor's language. */
export function createHandlebarsHighlighter(theme: GrafanaTheme2): Extension {
  const { codeEditor } = theme.components;

  const highlightTheme = EditorView.theme({
    [`.${className('delimiter')}`]: { color: codeEditor.operator },
    [`.${className('keyword')}`]: { color: codeEditor.controlKeyword },
    [`.${className('helper')}`]: { color: codeEditor.function },
    [`.${className('path')}`]: { color: codeEditor.variable },
    [`.${className('string')}`]: { color: codeEditor.string },
    [`.${className('number')}`]: { color: codeEditor.number },
    [`.${className('comment')}`]: { color: codeEditor.comment, fontStyle: 'italic' },
  });

  // Whole document per edit: about 3ms at the panel's 100k character limit.
  // A viewport scan would cut expressions that run past the edge of the view.
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildHandlebarsDecorations(view.state.doc.toString());
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildHandlebarsDecorations(update.state.doc.toString());
        }
      }
    },
    { decorations: (instance) => instance.decorations }
  );

  // Highest precedence nests the marks inside the language's spans, not around
  // them: a span's own color wins, and a Markdown heading colors its whole line.
  return [highlightTheme, Prec.highest(plugin)];
}

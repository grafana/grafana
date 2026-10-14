import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme } from '@grafana/data';
import { createCodeEditorTheme } from '@grafana/ui/unstable';

import { buildHandlebarsDecorations, createHandlebarsHighlighter, tokenizeHandlebars } from './handlebarsHighlight';

const sorted = (text: string) => tokenizeHandlebars(text).sort((left, right) => left.from - right.from);

const tokens = (text: string) => sorted(text).map(({ from, to, kind }) => [kind, text.slice(from, to)]);

describe('tokenizeHandlebars', () => {
  it('splits a plain expression into delimiters and a path', () => {
    expect(tokens('{{title}}')).toEqual([
      ['delimiter', '{{'],
      ['path', 'title'],
      ['delimiter', '}}'],
    ]);
  });

  it('reports offsets into the surrounding document, leaving prose untouched', () => {
    const text = '# {{title}} report';

    expect(sorted(text)).toEqual([
      { from: 2, to: 4, kind: 'delimiter' },
      { from: 4, to: 9, kind: 'path' },
      { from: 9, to: 11, kind: 'delimiter' },
    ]);
  });

  it('handles the unescaped triple-stache', () => {
    expect(tokens('{{{rawHtml}}}')).toEqual([
      ['delimiter', '{{{'],
      ['path', 'rawHtml'],
      ['delimiter', '}}}'],
    ]);
  });

  it('marks a registered helper as a helper and its arguments as paths and literals', () => {
    expect(tokens('{{toFixed fmt.Value 2}}')).toEqual([
      ['delimiter', '{{'],
      ['helper', 'toFixed'],
      ['path', 'fmt.Value'],
      ['number', '2'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks string and boolean arguments', () => {
    expect(tokens('{{date now "YYYY-MM-DD" true}}')).toEqual([
      ['delimiter', '{{'],
      ['helper', 'date'],
      ['path', 'now'],
      ['string', '"YYYY-MM-DD"'],
      ['number', 'true'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks hash arguments', () => {
    expect(tokens('{{json value indent=2}}')).toEqual([
      ['delimiter', '{{'],
      ['helper', 'json'],
      ['path', 'value'],
      ['path', 'indent'],
      ['delimiter', '='],
      ['number', '2'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks block keywords, their sigils and else', () => {
    expect(tokens('{{#if high}}a{{else}}b{{/if}}')).toEqual([
      ['delimiter', '{{'],
      ['delimiter', '#'],
      ['keyword', 'if'],
      ['path', 'high'],
      ['delimiter', '}}'],
      ['delimiter', '{{'],
      ['keyword', 'else'],
      ['delimiter', '}}'],
      ['delimiter', '{{'],
      ['delimiter', '/'],
      ['keyword', 'if'],
      ['delimiter', '}}'],
    ]);
  });

  it('keeps the chained keyword in an else-if', () => {
    expect(tokens('{{else if other}}')).toEqual([
      ['delimiter', '{{'],
      ['keyword', 'else'],
      ['keyword', 'if'],
      ['path', 'other'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks the helper at the head of a subexpression', () => {
    expect(tokens('{{#if (gt Value 5)}}')).toEqual([
      ['delimiter', '{{'],
      ['delimiter', '#'],
      ['keyword', 'if'],
      ['delimiter', '('],
      ['helper', 'gt'],
      ['path', 'Value'],
      ['number', '5'],
      ['delimiter', ')'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks each block params and data variables', () => {
    expect(tokens('{{#each frames as |f|}}{{@index}}{{/each}}')).toEqual([
      ['delimiter', '{{'],
      ['delimiter', '#'],
      ['keyword', 'each'],
      ['path', 'frames'],
      ['path', 'as'],
      ['delimiter', '|'],
      ['path', 'f'],
      ['delimiter', '|'],
      ['delimiter', '}}'],
      ['delimiter', '{{'],
      ['path', '@index'],
      ['delimiter', '}}'],
      ['delimiter', '{{'],
      ['delimiter', '/'],
      ['keyword', 'each'],
      ['delimiter', '}}'],
    ]);
  });

  it('marks a comment as one token, including the multi-line form', () => {
    expect(tokens('{{! a note }}')).toEqual([['comment', '{{! a note }}']]);
    expect(tokens('{{!--\nspanning lines\n--}}')).toEqual([['comment', '{{!--\nspanning lines\n--}}']]);
  });

  it('skips an escaped expression, which Handlebars renders literally', () => {
    expect(tokens('\\{{title}}')).toEqual([]);
  });

  it('ignores text that is not a complete expression', () => {
    expect(tokens('{{title')).toEqual([]);
    expect(tokens('closing}} only')).toEqual([]);
    expect(tokens('a { b } c')).toEqual([]);
  });

  it('tokenizes an expression that spans lines', () => {
    expect(tokens('{{#if\n  high}}')).toEqual([
      ['delimiter', '{{'],
      ['delimiter', '#'],
      ['keyword', 'if'],
      ['path', 'high'],
      ['delimiter', '}}'],
    ]);
  });

  it('tokenizes an expression inside an HTML attribute', () => {
    expect(tokens('<a href="{{url}}">')).toEqual([
      ['delimiter', '{{'],
      ['path', 'url'],
      ['delimiter', '}}'],
    ]);
  });
});

describe('buildHandlebarsDecorations', () => {
  // Decoration.set rejects unsorted ranges, so this covers the sort flag.
  it('turns every token into a decoration', () => {
    const text = '{{#each data}}{{fmt.Value}}{{/each}}';

    expect(buildHandlebarsDecorations(text).size).toBe(tokenizeHandlebars(text).length);
  });

  it('produces no decorations for text without expressions', () => {
    expect(buildHandlebarsDecorations('# Just a heading').size).toBe(0);
  });
});

describe('createHandlebarsHighlighter', () => {
  const mount = (doc: string) => {
    const theme = createTheme();

    return new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [markdown(), createCodeEditorTheme(theme), createHandlebarsHighlighter(theme)],
      }),
    });
  };

  // A heading colors its whole line, and a span's own color wins, so marks must be innermost.
  it('marks expressions inside the spans the language highlights, not around them', () => {
    const view = mount('# {{title}}');
    const marks = view.contentDOM.querySelectorAll('[class^="cm-handlebars-"]');

    expect(Array.from(marks, (mark) => mark.className)).toEqual([
      'cm-handlebars-delimiter',
      'cm-handlebars-path',
      'cm-handlebars-delimiter',
    ]);
    marks.forEach((mark) => expect(mark.children).toHaveLength(0));
    expect(marks[0].parentElement).not.toBe(view.contentDOM.firstElementChild);

    view.destroy();
  });
});

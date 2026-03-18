import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createGenericHighlighter } from './highlight';
import { SyntaxHighlightConfig } from './types';

// Mock DOM elements required by CodeMirror
beforeAll(() => {
  Range.prototype.getClientRects = jest.fn(() => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: jest.fn(),
  }));
  Range.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    toJSON: () => {},
  }));
});

describe('createGenericHighlighter', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function createEditorWithHighlighter(config: SyntaxHighlightConfig, text: string) {
    const highlighter = createGenericHighlighter(config);
    const state = EditorState.create({ doc: text, extensions: [highlighter] });
    return new EditorView({ state, parent: container });
  }

  it('highlights text matching the pattern', () => {
    const view = createEditorWithHighlighter(
      { pattern: /\$\{[^}]+\}/g, className: 'test-highlight' },
      'Hello ${world}!'
    );
    expect(view.dom).toHaveTextContent('Hello ${world}!');
    view.destroy();
  });

  it('highlights multiple matches', () => {
    const view = createEditorWithHighlighter(
      { pattern: /\$\{[^}]+\}/g, className: 'variable' },
      '${first} and ${second}'
    );
    expect(view.dom).toHaveTextContent('${first} and ${second}');
    view.destroy();
  });

  it('handles text with no matches', () => {
    const view = createEditorWithHighlighter({ pattern: /\$\{[^}]+\}/g, className: 'variable' }, 'No variables here');
    expect(view.dom).toHaveTextContent('No variables here');
    view.destroy();
  });

  it('handles empty text', () => {
    const view = createEditorWithHighlighter({ pattern: /\$\{[^}]+\}/g, className: 'variable' }, '');
    expect(view.dom).toHaveTextContent('');
    view.destroy();
  });

  it('does not highlight incomplete variables (no closing brace)', () => {
    const view = createEditorWithHighlighter({ pattern: /\$\{[^}]+\}/g, className: 'variable' }, '${incomplete');
    // No decoration, but content is preserved
    expect(view.state.doc.toString()).toBe('${incomplete');
    view.destroy();
  });

  it('resets lastIndex correctly on second call with same instance', () => {
    const config: SyntaxHighlightConfig = { pattern: /\$\{[^}]+\}/g, className: 'variable' };
    const view1 = createEditorWithHighlighter(config, '${var1}');
    expect(view1.dom).toHaveTextContent('${var1}');
    view1.destroy();

    // Same config instance — lastIndex must be reset each build
    const view2 = createEditorWithHighlighter(config, '${var2}');
    expect(view2.dom).toHaveTextContent('${var2}');
    view2.destroy();
  });

  it('updates decorations when document changes', () => {
    const view = createEditorWithHighlighter({ pattern: /\$\{[^}]+\}/g, className: 'variable' }, 'Initial text');
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'New ${variable} text' } });
    expect(view.dom).toHaveTextContent('New ${variable} text');
    view.destroy();
  });

  it('highlights variables in URLs', () => {
    const view = createEditorWithHighlighter(
      { pattern: /\$\{[^}]+\}/g, className: 'variable' },
      'https://example.com?id=${id}&name=${name}'
    );
    expect(view.dom).toHaveTextContent('https://example.com?id=${id}&name=${name}');
    view.destroy();
  });
});

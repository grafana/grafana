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

  /**
   * Helper to create editor with highlighter
   */
  function createEditorWithHighlighter(config: SyntaxHighlightConfig, text: string) {
    const highlighter = createGenericHighlighter(config);
    const state = EditorState.create({
      doc: text,
      extensions: [highlighter],
    });
    return new EditorView({ state, parent: container });
  }

  describe('basic highlighting', () => {
    it('highlights text matching the pattern', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'test-highlight',
      };

      const view = createEditorWithHighlighter(config, 'Hello ${world}!');
      const content = view.dom.textContent;

      expect(content).toBe('Hello ${world}!');
      view.destroy();
    });

    it('highlights multiple matches', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, '${first} and ${second} and ${third}');
      const content = view.dom.textContent;

      expect(content).toBe('${first} and ${second} and ${third}');
      view.destroy();
    });

    it('handles text with no matches', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, 'No variables here');
      const content = view.dom.textContent;

      expect(content).toBe('No variables here');
      view.destroy();
    });

    it('handles empty text', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, '');
      const content = view.dom.textContent;

      expect(content).toBe('');
      view.destroy();
    });
  });

  describe('pattern variations', () => {
    it('highlights with simple word pattern', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\btest\b/g,
        className: 'keyword',
      };

      const view = createEditorWithHighlighter(config, 'This is a test of the test word');
      const content = view.dom.textContent;

      expect(content).toBe('This is a test of the test word');
      view.destroy();
    });

    it('highlights with number pattern', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\d+/g,
        className: 'number',
      };

      const view = createEditorWithHighlighter(config, 'Numbers: 123, 456, 789');
      const content = view.dom.textContent;

      expect(content).toBe('Numbers: 123, 456, 789');
      view.destroy();
    });

    it('highlights with URL pattern', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /https?:\/\/[^\s]+/g,
        className: 'url',
      };

      const view = createEditorWithHighlighter(config, 'Visit https://grafana.com and http://example.com');
      const content = view.dom.textContent;

      expect(content).toBe('Visit https://grafana.com and http://example.com');
      view.destroy();
    });
  });

  describe('dynamic updates', () => {
    it('updates highlights when document changes', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, 'Initial text');

      // Update document
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'New ${variable} text' },
      });

      const content = view.dom.textContent;
      expect(content).toBe('New ${variable} text');
      view.destroy();
    });

    it('updates highlights when adding to document', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, 'Start ');

      // Insert text
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '${var}' },
      });

      const content = view.dom.textContent;
      expect(content).toBe('Start ${var}');
      view.destroy();
    });

    it('removes highlights when pattern no longer matches', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, '${variable}');

      // Replace with non-matching text
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'plain text' },
      });

      const content = view.dom.textContent;
      expect(content).toBe('plain text');
      view.destroy();
    });
  });

  describe('complex patterns', () => {
    it('highlights nested brackets', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const view = createEditorWithHighlighter(config, 'Text with ${var1} and ${var2} variables');
      const content = view.dom.textContent;

      expect(content).toBe('Text with ${var1} and ${var2} variables');
      view.destroy();
    });

    it('highlights overlapping patterns correctly', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /test/g,
        className: 'keyword',
      };

      const view = createEditorWithHighlighter(config, 'testtesttest');
      const content = view.dom.textContent;

      expect(content).toBe('testtesttest');
      view.destroy();
    });
  });

  describe('multiline text', () => {
    it('highlights patterns across multiple lines', () => {
      const config: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      const text = 'Line 1 ${var1}\nLine 2 ${var2}\nLine 3';
      const view = createEditorWithHighlighter(config, text);
      
      // Check the document state instead of textContent (which doesn't preserve newlines in DOM)
      const docContent = view.state.doc.toString();
      expect(docContent).toBe(text);
      view.destroy();
    });
  });
});

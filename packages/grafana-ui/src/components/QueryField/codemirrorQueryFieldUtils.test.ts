import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { CompletionItemGroup } from '../../types/completion';

import {
  createQueryFieldAutocompletion,
  createRunQueryKeymap,
  createTabSpacesKeymap,
  createTypeaheadAutocompletion,
} from './codemirrorQueryFieldUtils';

// Helper function to create a mock CompletionContext for testing
// We implement only the properties that createTypeaheadAutocompletion uses
// Other properties are stubs that won't be called during testing
function createMockCompletionContext(
  state: EditorState,
  pos: number,
  explicit: boolean,
  matchBeforeResult: { from: number; to: number; text: string } | null
): CompletionContext {
  return {
    state,
    pos,
    explicit,
    aborted: false,
    matchBefore: () => matchBeforeResult,
    // Stub implementations for unused properties
    tokenBefore: () => [],
    advance: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as CompletionContext;
}

describe('codemirrorQueryFieldUtils', () => {
  describe('createTabSpacesKeymap', () => {
    it('should create a keymap extension for 2 spaces', () => {
      const extension = createTabSpacesKeymap(2);
      expect(extension).toBeDefined();

      const state = EditorState.create({
        doc: 'SELECT',
        extensions: [extension],
      });

      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('SELECT');
    });

    it('should create a keymap extension for 4 spaces', () => {
      const extension = createTabSpacesKeymap(4);
      expect(extension).toBeDefined();

      const state = EditorState.create({
        doc: 'SELECT',
        extensions: [extension],
      });

      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('SELECT');
    });

    it('should create a keymap extension for 0 spaces (disabled)', () => {
      const extension = createTabSpacesKeymap(0);
      expect(extension).toBeDefined();
    });
  });

  describe('createRunQueryKeymap', () => {
    it('should create a keymap extension with highest priority', () => {
      const onRunQuery = jest.fn();
      const extension = createRunQueryKeymap(onRunQuery);

      expect(extension).toBeDefined();

      const state = EditorState.create({
        doc: 'SELECT * FROM users',
        extensions: [extension],
      });

      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('SELECT * FROM users');
    });

    it('should integrate with EditorView', () => {
      const onRunQuery = jest.fn();
      const extension = createRunQueryKeymap(onRunQuery);

      const state = EditorState.create({
        doc: 'SELECT * FROM users',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
      });

      expect(view).toBeDefined();
      expect(view.state.doc.toString()).toBe('SELECT * FROM users');

      view.destroy();
    });
  });

  describe('createTypeaheadAutocompletion', () => {
    it('should return null when no prefix and not explicit', async () => {
      const onTypeahead = jest.fn();
      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT ',
      });

      const context = createMockCompletionContext(state, 7, false, null);

      const result = await completionSource(context);

      expect(result).toBeNull();
      expect(onTypeahead).not.toHaveBeenCalled();
    });

    it('should call onTypeahead with correct prefix', async () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [
          {
            label: 'Keywords',
            items: [
              { label: 'FROM', kind: 'keyword' },
              { label: 'WHERE', kind: 'keyword' },
            ],
          },
        ],
      });

      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT FR',
      });

      const context = createMockCompletionContext(state, 9, false, { from: 7, to: 9, text: 'FR' });

      const result = await completionSource(context);

      expect(onTypeahead).toHaveBeenCalledWith({
        text: 'SELECT FR',
        prefix: 'FR',
        wrapperClasses: [],
      });

      expect(result).not.toBeNull();
      expect(result?.options).toHaveLength(3); // 1 header + 2 items
      expect(result?.options[0].label).toBe('Keywords');
      expect(result?.options[0].type).toBe('header');
      expect(result?.options[1].label).toBe('FROM');
      expect(result?.options[2].label).toBe('WHERE');
    });

    it('should handle empty suggestions', async () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [],
      });

      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT XYZ',
      });

      const context = createMockCompletionContext(state, 10, true, { from: 7, to: 10, text: 'XYZ' });

      const result = await completionSource(context);

      expect(result).toBeNull();
    });

    it('should handle completion items with insertText', async () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [
          {
            label: 'Functions',
            items: [
              {
                label: 'rate()',
                kind: 'function',
                insertText: 'rate($0)',
                documentation: 'Calculate rate',
              },
            ],
          },
        ],
      });

      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT ra',
      });

      const context = createMockCompletionContext(state, 9, false, { from: 7, to: 9, text: 'ra' });

      const result = await completionSource(context);

      expect(result).not.toBeNull();
      expect(result?.options[1].label).toBe('rate()');
      expect(result?.options[1].apply).toBe('rate($0)');
      expect(result?.options[1].info).toBe('Calculate rate');
    });

    it('should handle completion items with deleteBackwards and move', async () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [
          {
            label: 'Functions',
            items: [
              {
                label: 'sum',
                kind: 'function',
                insertText: 'sum by ()',
                deleteBackwards: 3,
                move: -1,
              },
            ],
          },
        ],
      });

      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT sum',
      });

      const context = createMockCompletionContext(state, 10, false, { from: 7, to: 10, text: 'sum' });

      const result = await completionSource(context);

      expect(result).not.toBeNull();
      expect(result?.options[1].label).toBe('sum');
      expect(typeof result?.options[1].apply).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      const onTypeahead = jest.fn().mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT ',
      });

      const context = createMockCompletionContext(state, 7, true, { from: 7, to: 7, text: '' });

      const result = await completionSource(context);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in typeahead autocompletion:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple groups with items', async () => {
      const suggestions: CompletionItemGroup[] = [
        {
          label: 'Keywords',
          items: [
            { label: 'SELECT', kind: 'keyword' },
            { label: 'FROM', kind: 'keyword' },
          ],
        },
        {
          label: 'Tables',
          items: [
            { label: 'users', kind: 'table' },
            { label: 'orders', kind: 'table' },
          ],
        },
      ];

      const onTypeahead = jest.fn().mockResolvedValue({ suggestions });
      const completionSource = createTypeaheadAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SELECT ',
      });

      const context = createMockCompletionContext(state, 7, true, { from: 7, to: 7, text: '' });

      const result = await completionSource(context);

      expect(result).not.toBeNull();
      // 2 headers + 4 items = 6 total
      expect(result?.options).toHaveLength(6);
      expect(result?.options[0].label).toBe('Keywords');
      expect(result?.options[0].type).toBe('header');
      expect(result?.options[3].label).toBe('Tables');
      expect(result?.options[3].type).toBe('header');
    });
  });

  describe('createQueryFieldAutocompletion', () => {
    it('should create an autocompletion extension', () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [],
      });

      const extension = createQueryFieldAutocompletion(onTypeahead);

      expect(extension).toBeDefined();
      // Extension should be an array or object with extension properties
      expect(Array.isArray(extension) || typeof extension === 'object').toBe(true);
    });

    it('should integrate with EditorState', () => {
      const onTypeahead = jest.fn().mockResolvedValue({
        suggestions: [
          {
            label: 'Keywords',
            items: [{ label: 'SELECT', kind: 'keyword' }],
          },
        ],
      });

      const extension = createQueryFieldAutocompletion(onTypeahead);

      const state = EditorState.create({
        doc: 'SEL',
        extensions: [extension],
      });

      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('SEL');
    });
  });
});

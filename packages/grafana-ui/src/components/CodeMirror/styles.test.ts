import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme } from '@grafana/data';

import { createGenericTheme } from './styles';

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

describe('createGenericTheme', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  /**
   * Helper to create editor with theme
   */
  function createEditorWithTheme(themeMode: 'light' | 'dark', text = 'test') {
    const theme = createTheme({ colors: { mode: themeMode } });
    const themeExtension = createGenericTheme(theme);
    const state = EditorState.create({
      doc: text,
      extensions: [themeExtension],
    });
    return new EditorView({ state, parent: container });
  }

  describe('theme creation', () => {
    it('creates theme for light mode', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createGenericTheme(theme);

      expect(themeExtension).toBeDefined();
    });

    it('creates theme for dark mode', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const themeExtension = createGenericTheme(theme);

      expect(themeExtension).toBeDefined();
    });

    it('applies theme to editor in light mode', () => {
      const view = createEditorWithTheme('light');

      expect(view).toBeDefined();
      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('applies theme to editor in dark mode', () => {
      const view = createEditorWithTheme('dark');

      expect(view).toBeDefined();
      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });
  });

  describe('theme properties', () => {
    it('applies typography settings from theme', () => {
      const theme = createTheme({ colors: { mode: 'light' } });
      const themeExtension = createGenericTheme(theme);

      const state = EditorState.create({
        doc: 'test',
        extensions: [themeExtension],
      });
      const view = new EditorView({ state, parent: container });

      // Check that editor is created successfully
      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('applies color settings from theme', () => {
      const theme = createTheme({ colors: { mode: 'dark' } });
      const themeExtension = createGenericTheme(theme);

      const state = EditorState.create({
        doc: 'test',
        extensions: [themeExtension],
      });
      const view = new EditorView({ state, parent: container });

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });
  });

  describe('theme updates', () => {
    it('switches from light to dark theme', () => {
      const themeCompartment = new Compartment();
      const lightTheme = createTheme({ colors: { mode: 'light' } });
      const lightThemeExtension = createGenericTheme(lightTheme);

      const state = EditorState.create({
        doc: 'test',
        extensions: [themeCompartment.of(lightThemeExtension)],
      });
      const view = new EditorView({ state, parent: container });

      // Update to dark theme
      const darkTheme = createTheme({ colors: { mode: 'dark' } });
      const darkThemeExtension = createGenericTheme(darkTheme);

      view.dispatch({
        effects: themeCompartment.reconfigure(darkThemeExtension),
      });

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });

    it('switches from dark to light theme', () => {
      const themeCompartment = new Compartment();
      const darkTheme = createTheme({ colors: { mode: 'dark' } });
      const darkThemeExtension = createGenericTheme(darkTheme);

      const state = EditorState.create({
        doc: 'test',
        extensions: [themeCompartment.of(darkThemeExtension)],
      });
      const view = new EditorView({ state, parent: container });

      // Update to light theme
      const lightTheme = createTheme({ colors: { mode: 'light' } });
      const lightThemeExtension = createGenericTheme(lightTheme);

      view.dispatch({
        effects: themeCompartment.reconfigure(lightThemeExtension),
      });

      expect(view.dom).toBeInstanceOf(HTMLElement);
      view.destroy();
    });
  });

  describe('editor rendering', () => {
    it('renders editor with light theme and content', () => {
      const view = createEditorWithTheme('light', 'Hello world!');

      expect(view.dom).toHaveTextContent('Hello world!');
      view.destroy();
    });

    it('renders editor with dark theme and content', () => {
      const view = createEditorWithTheme('dark', 'Hello world!');

      expect(view.dom).toHaveTextContent('Hello world!');
      view.destroy();
    });

    it('renders multiline content with theme', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const view = createEditorWithTheme('light', text);

      // Check the document state instead of textContent (which doesn't preserve newlines in DOM)
      const docContent = view.state.doc.toString();
      expect(docContent).toBe(text);
      view.destroy();
    });
  });
});

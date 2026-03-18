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

  function createEditorWithTheme(themeMode: 'light' | 'dark', text = 'test') {
    const theme = createTheme({ colors: { mode: themeMode } });
    const themeExtension = createGenericTheme(theme);
    const state = EditorState.create({
      doc: text,
      extensions: [themeExtension],
    });
    return new EditorView({ state, parent: container });
  }

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
    expect(view.dom).toBeInstanceOf(HTMLElement);
    view.destroy();
  });

  it('applies theme to editor in dark mode', () => {
    const view = createEditorWithTheme('dark');
    expect(view.dom).toBeInstanceOf(HTMLElement);
    view.destroy();
  });

  it('switches from light to dark theme via Compartment', () => {
    const themeCompartment = new Compartment();
    const lightTheme = createTheme({ colors: { mode: 'light' } });
    const state = EditorState.create({
      doc: 'test',
      extensions: [themeCompartment.of(createGenericTheme(lightTheme))],
    });
    const view = new EditorView({ state, parent: container });

    const darkTheme = createTheme({ colors: { mode: 'dark' } });
    view.dispatch({ effects: themeCompartment.reconfigure(createGenericTheme(darkTheme)) });

    expect(view.dom).toBeInstanceOf(HTMLElement);
    view.destroy();
  });

  it('renders content correctly', () => {
    const view = createEditorWithTheme('light', 'Hello world!');
    expect(view.dom).toHaveTextContent('Hello world!');
    view.destroy();
  });
});

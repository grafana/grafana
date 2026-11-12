import {
  acceptCompletion,
  autocompletion,
  CompletionContext,
  startCompletion,
  type CompletionSource,
} from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { keymap, type EditorView as CodeMirrorEditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView, type ReactCodeMirrorProps } from '@uiw/react-codemirror';

import { createTheme, type GrafanaTheme2, VariableOrigin } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';

import { mockThemeContext } from '../../themes/ThemeContext';

import { CodeEditor } from './CodeEditor';
import { loadLanguageExtension } from './languageLoader';
import { createCodeEditorTheme } from './theme';
import { type CodeMirrorEditorProps, type CodeMirrorThemeOverrides } from './types';

let capturedProps: ReactCodeMirrorProps | undefined;

jest.mock('@uiw/react-codemirror', () => {
  const actual = jest.requireActual('@uiw/react-codemirror');

  return {
    __esModule: true,
    ...actual,
    default: jest.fn((props) => {
      capturedProps = props;
      return null;
    }),
  };
});

jest.mock('@codemirror/autocomplete', () => {
  const actual = jest.requireActual('@codemirror/autocomplete');

  return {
    ...actual,
    autocompletion: jest.fn(() => []),
    startCompletion: jest.fn(() => true),
  };
});

jest.mock('./languageLoader', () => ({
  __esModule: true,
  loadLanguageExtension: jest.fn(),
}));

jest.mock('./theme', () => ({
  createCodeEditorTheme: jest.fn(() => ['grafana-code-editor-theme']),
}));

jest.mock('@grafana/faro-web-sdk', () => ({
  faro: {
    api: {
      pushError: jest.fn(),
    },
  },
}));

const autocompletionMock = autocompletion as jest.MockedFunction<typeof autocompletion>;
const startCompletionMock = startCompletion as jest.MockedFunction<typeof startCompletion>;
const loadLanguageExtensionMock = loadLanguageExtension as jest.MockedFunction<typeof loadLanguageExtension>;
const createCodeEditorThemeMock = createCodeEditorTheme as jest.MockedFunction<typeof createCodeEditorTheme>;

const getExtensions = () => capturedProps?.extensions ?? [];

const getAutocompleteSources = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  }).languageDataAt<CompletionSource>('autocomplete', 0);

const getKeyBindings = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  })
    .facet(keymap)
    .flat();

const getContentAttributes = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  }).facet(EditorView.contentAttributes);

describe('CodeMirror CodeEditor', () => {
  beforeEach(() => {
    capturedProps = undefined;
    autocompletionMock.mockClear();
    startCompletionMock.mockClear();
    loadLanguageExtensionMock.mockClear();
    createCodeEditorThemeMock.mockClear();
    loadLanguageExtensionMock.mockResolvedValue(null);
    (faro.api.pushError as jest.Mock).mockClear();
  });

  it('merge mode contributes completionSources through language data and keeps the language sources', async () => {
    const languageSource = jest.fn();
    const customSourceA = jest.fn();
    const customSourceB = jest.fn();
    loadLanguageExtensionMock.mockResolvedValue(EditorState.languageData.of(() => [{ autocomplete: languageSource }]));

    render(
      <CodeEditor value="" onChange={jest.fn()} language="sql" completionSources={[customSourceA, customSourceB]} />
    );

    await waitFor(() => expect(getAutocompleteSources()).toContain(languageSource));
    expect(autocompletionMock).toHaveBeenLastCalledWith();
    expect(getAutocompleteSources()).toEqual(expect.arrayContaining([languageSource, customSourceA, customSourceB]));
  });

  it('override mode configures autocompletion override without adding completionSources to language data', async () => {
    const languageSource = jest.fn();
    const customSourceA = jest.fn();
    const customSourceB = jest.fn();
    loadLanguageExtensionMock.mockResolvedValue(EditorState.languageData.of(() => [{ autocomplete: languageSource }]));

    render(
      <CodeEditor
        value=""
        onChange={jest.fn()}
        language="sql"
        completionSources={[customSourceA, customSourceB]}
        completionMode="override"
      />
    );

    await waitFor(() => expect(getAutocompleteSources()).toEqual([languageSource]));
    expect(autocompletionMock).toHaveBeenLastCalledWith({ override: [customSourceA, customSourceB] });
  });

  it('does not configure autocompletion when completionSources is missing', async () => {
    const languageSource = jest.fn();
    loadLanguageExtensionMock.mockResolvedValue(EditorState.languageData.of(() => [{ autocomplete: languageSource }]));

    render(<CodeEditor value="" onChange={jest.fn()} language="sql" />);

    await waitFor(() => expect(getAutocompleteSources()).toEqual([languageSource]));
    expect(autocompletionMock).not.toHaveBeenCalled();
  });

  it('offers variable suggestions next to completionSources in override mode', async () => {
    const customSource = jest.fn();

    render(
      <CodeEditor
        value="$"
        onChange={jest.fn()}
        completionMode="override"
        completionSources={[customSource]}
        variableSuggestions={[{ value: 'region', label: 'region', origin: VariableOrigin.Template }]}
      />
    );

    const override = autocompletionMock.mock.calls[0]?.[0]?.override ?? [];
    expect(override).toHaveLength(2);
    expect(override[0]).toBe(customSource);
    const result = await override[1](new CompletionContext(EditorState.create({ doc: '$' }), 1, false));
    expect(result?.options.map((option) => option.label)).toEqual(['region']);
  });

  it('adds no variable source when there are no variable suggestions', () => {
    render(<CodeEditor value="$" onChange={jest.fn()} variableSuggestions={[]} />);

    expect(capturedProps?.value).toBe('$');
    expect(autocompletionMock).not.toHaveBeenCalled();
    expect(getAutocompleteSources()).toEqual([]);
  });

  it('drops props outside the public API, so raw extensions never reach CodeMirror', () => {
    const props = {
      value: '',
      onChange: jest.fn(),
      'aria-label': 'Query',
      extensions: [EditorView.contentAttributes.of({ 'data-plugin': 'injected' })],
    } as unknown as CodeMirrorEditorProps;

    render(<CodeEditor {...props} />);

    expect(getContentAttributes()).toEqual([{ 'aria-label': 'Query' }]);
  });

  it('binds Tab to accept completions before the default indent behavior', () => {
    render(<CodeEditor value="" onChange={jest.fn()} />);

    const tabBinding = getKeyBindings().find((binding) => binding.key === 'Tab');

    expect(tabBinding).toEqual(expect.objectContaining({ key: 'Tab', run: acceptCompletion }));
  });

  it('leaves Space unbound by default, so a space cannot open the popup as an explicit request', () => {
    render(<CodeEditor value="a sentence" onChange={jest.fn()} completionSources={[jest.fn()]} />);

    expect(getKeyBindings().find((binding) => binding.key === 'Space')).toBeUndefined();
  });

  it('binds Space to insert a space and start completions when completeOnSpace is set', () => {
    render(<CodeEditor value="SELECT" onChange={jest.fn()} completionSources={[jest.fn()]} completeOnSpace />);

    const spaceBinding = getKeyBindings().find((binding) => binding.key === 'Space');
    const replaceSelection = jest.fn(() => ({ changes: { from: 6, insert: ' ' } }));
    const dispatch = jest.fn();
    const view = {
      dispatch,
      state: {
        readOnly: false,
        replaceSelection,
      },
    } as unknown as CodeMirrorEditorView;

    expect(spaceBinding?.run?.(view)).toBe(true);
    expect(replaceSelection).toHaveBeenCalledWith(' ');
    expect(dispatch).toHaveBeenCalledWith({ changes: { from: 6, insert: ' ' } });
    expect(startCompletionMock).toHaveBeenCalledWith(view);
  });

  it('adds accessibility attributes to the editor content when provided', () => {
    render(<CodeEditor value="" onChange={jest.fn()} aria-label="Code editor" aria-labelledby="code-editor-label" />);

    expect(getContentAttributes()).toEqual(
      expect.arrayContaining([{ 'aria-label': 'Code editor', 'aria-labelledby': 'code-editor-label' }])
    );
  });

  it('does not attach a blur handler when onBlur is not provided', () => {
    render(<CodeEditor value="" onChange={jest.fn()} />);

    expect(capturedProps?.onBlur).toBeUndefined();
  });

  it('prevents browser save and uses the current document as onSave is added, replaced, and removed', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onSave = jest.fn();
    const nextOnSave = jest.fn();
    const onKeyDown = jest.fn();
    const { rerender } = render(<CodeEditor value="initial" onChange={onChange} />);
    const view = new EditorView({
      state: EditorState.create({ doc: 'SELECT 1', extensions: getExtensions() as never[] }),
      parent: document.body,
    });
    view.contentDOM.addEventListener('keydown', onKeyDown);

    try {
      view.focus();
      await user.keyboard('{Control>}s{/Control}');
      expect(onKeyDown).toHaveBeenLastCalledWith(expect.objectContaining({ key: 's', defaultPrevented: true }));

      rerender(<CodeEditor value="initial" onChange={onChange} onSave={onSave} />);
      await user.keyboard('{Control>}s{/Control}');
      expect(onSave.mock.calls).toEqual([['SELECT 1']]);

      await user.keyboard('{Control>}q{/Control}');
      expect(onKeyDown).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'q', defaultPrevented: false }));
      expect(onSave.mock.calls).toEqual([['SELECT 1']]);

      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'SELECT 2' } });
      rerender(<CodeEditor value="initial" onChange={onChange} onSave={nextOnSave} />);
      await user.keyboard('{Control>}s{/Control}');
      expect(nextOnSave.mock.calls).toEqual([['SELECT 2']]);

      rerender(<CodeEditor value="initial" onChange={onChange} />);
      await user.keyboard('{Control>}s{/Control}');
      expect(onKeyDown).toHaveBeenLastCalledWith(expect.objectContaining({ key: 's', defaultPrevented: true }));
      expect(onSave.mock.calls).toEqual([['SELECT 1']]);
      expect(nextOnSave.mock.calls).toEqual([['SELECT 2']]);
    } finally {
      view.destroy();
    }
  });

  it('defaults to the Grafana CodeEditor theme when no theme prop is provided', () => {
    render(<CodeEditor value="" onChange={jest.fn()} />);

    expect(createCodeEditorThemeMock).toHaveBeenCalledTimes(1);
    expect(capturedProps?.theme).toBe(createCodeEditorThemeMock.mock.results[0].value);
  });

  it('regenerates the default editor theme when the Grafana theme changes', () => {
    const { rerender } = render(<CodeEditor value="" onChange={jest.fn()} />);
    const initialTheme = createCodeEditorThemeMock.mock.calls[0][0] as GrafanaTheme2;
    const nextTheme = createTheme({ colors: { mode: initialTheme.isDark ? 'light' : 'dark' } });
    const restoreThemeContext = mockThemeContext(nextTheme);

    rerender(<CodeEditor value="" onChange={jest.fn()} />);

    expect(createCodeEditorThemeMock).toHaveBeenLastCalledWith(nextTheme, undefined);
    expect(capturedProps?.theme).toBe(createCodeEditorThemeMock.mock.results.at(-1)?.value);

    restoreThemeContext();
  });

  it.each([
    { shape: 'theme extension array', makeTheme: () => EditorView.theme({ '&': { color: 'rgb(7, 7, 7)' } }) },
    { shape: 'theme extension object', makeTheme: () => ({ extension: EditorView.theme({}) }) },
    { shape: 'built-in keyword', makeTheme: () => 'dark' },
  ])('ignores a $shape and keeps the Grafana theme', ({ makeTheme }) => {
    const props = { value: '', onChange: jest.fn(), theme: makeTheme() } as unknown as CodeMirrorEditorProps;

    render(<CodeEditor {...props} />);

    expect(createCodeEditorThemeMock).toHaveBeenLastCalledWith(expect.anything(), undefined);
    expect(capturedProps?.theme).toBe(createCodeEditorThemeMock.mock.results.at(-1)?.value);
  });

  it('merges declarative theme overrides and restores defaults when they are removed', () => {
    const onChange = jest.fn();
    const overrides: CodeMirrorThemeOverrides = {
      '&': { backgroundColor: 'transparent' },
      '.cm-gutters': { backgroundColor: 'transparent' },
    };
    const { rerender } = render(<CodeEditor value="" onChange={onChange} theme={overrides} />);
    expect(createCodeEditorThemeMock).toHaveBeenLastCalledWith(expect.anything(), overrides);
    expect(capturedProps?.theme).toBe(createCodeEditorThemeMock.mock.results.at(-1)?.value);

    rerender(<CodeEditor value="" onChange={onChange} />);
    expect(createCodeEditorThemeMock).toHaveBeenLastCalledWith(expect.anything(), undefined);
    expect(capturedProps?.theme).toBe(createCodeEditorThemeMock.mock.results.at(-1)?.value);
  });

  it('forwards basicSetup to CodeMirror so consumers can disable default features', () => {
    const basicSetup = { lineNumbers: false, foldGutter: false } as const;

    render(<CodeEditor value="" onChange={jest.fn()} basicSetup={basicSetup} />);

    expect((capturedProps as { basicSetup?: unknown } | undefined)?.basicSetup).toBe(basicSetup);
  });

  it('loads language extensions lazily when language is provided', async () => {
    const languageExtension = EditorState.languageData.of(() => [{ autocomplete: jest.fn() }]);
    loadLanguageExtensionMock.mockResolvedValue(languageExtension);

    render(<CodeEditor value="" onChange={jest.fn()} language="sql" />);

    await waitFor(() => expect(loadLanguageExtensionMock).toHaveBeenCalledWith('sql', { sqlDialect: undefined }));
    await waitFor(() => expect(getExtensions()).toContain(languageExtension));
  });

  it('forwards the sqlDialect to the language loader', async () => {
    const languageExtension = EditorState.languageData.of(() => [{ autocomplete: jest.fn() }]);
    loadLanguageExtensionMock.mockResolvedValue(languageExtension);

    render(<CodeEditor value="" onChange={jest.fn()} language="sql" sqlDialect="mySql" />);

    await waitFor(() => expect(loadLanguageExtensionMock).toHaveBeenCalledWith('sql', { sqlDialect: 'mySql' }));
  });

  it('reports language extension load failures and shows a warning while keeping the editor rendered', async () => {
    const error = new Error('Failed to import SQL support');
    loadLanguageExtensionMock.mockRejectedValue(error);

    render(<CodeEditor value="" onChange={jest.fn()} language="sql" />);

    expect(await screen.findByText('Syntax highlighting failed to load')).toBeInTheDocument();
    expect(screen.getByText('The editor will continue without language-specific features.')).toBeInTheDocument();
    expect(faro.api.pushError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        context: expect.objectContaining({
          type: 'async',
          source: 'CodeMirror.useLanguageExtension',
          language: 'sql',
        }),
      })
    );
  });
});

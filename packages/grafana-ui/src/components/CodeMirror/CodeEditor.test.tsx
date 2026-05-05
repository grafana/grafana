import { acceptCompletion, autocompletion, startCompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { keymap, type EditorView as CodeMirrorEditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import { EditorView } from '@uiw/react-codemirror';

import { faro } from '@grafana/faro-web-sdk';

import { CodeEditor } from './CodeEditor';
import { loadLanguageExtension } from './languageLoader';

let capturedProps: { extensions?: unknown[]; theme?: unknown; onChange?: unknown } | undefined;

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
    loadLanguageExtensionMock.mockResolvedValue(null);
    (faro.api.pushError as jest.Mock).mockClear();
  });

  it('merge mode contributes completionSources through language data and keeps existing sources', () => {
    const existingSource = jest.fn();
    const customSourceA = jest.fn();
    const customSourceB = jest.fn();

    render(
      <CodeEditor
        value=""
        onChange={jest.fn()}
        completionSources={[customSourceA, customSourceB]}
        extensions={[EditorState.languageData.of(() => [{ autocomplete: existingSource }])]}
      />
    );

    expect(autocompletionMock).toHaveBeenCalledTimes(1);
    expect(autocompletionMock).toHaveBeenCalledWith();
    expect(getAutocompleteSources()).toEqual(expect.arrayContaining([existingSource, customSourceA, customSourceB]));
  });

  it('override mode configures autocompletion override without adding completionSources to language data', () => {
    const existingSource = jest.fn();
    const customSourceA = jest.fn();
    const customSourceB = jest.fn();

    render(
      <CodeEditor
        value=""
        onChange={jest.fn()}
        completionSources={[customSourceA, customSourceB]}
        completionMode="override"
        extensions={[EditorState.languageData.of(() => [{ autocomplete: existingSource }])]}
      />
    );

    expect(autocompletionMock).toHaveBeenCalledTimes(1);
    expect(autocompletionMock).toHaveBeenCalledWith({ override: [customSourceA, customSourceB] });
    expect(getAutocompleteSources()).toEqual([existingSource]);
  });

  it('does not configure autocompletion when completionSources is missing', () => {
    const existingSource = jest.fn();

    render(
      <CodeEditor
        value=""
        onChange={jest.fn()}
        extensions={[EditorState.languageData.of(() => [{ autocomplete: existingSource }])]}
      />
    );

    expect(autocompletionMock).not.toHaveBeenCalled();
    expect(getAutocompleteSources()).toEqual([existingSource]);
  });

  it('binds Tab to accept completions before the default indent behavior', () => {
    render(<CodeEditor value="" onChange={jest.fn()} />);

    const tabBinding = getKeyBindings().find((binding) => binding.key === 'Tab');

    expect(tabBinding).toEqual(expect.objectContaining({ key: 'Tab', run: acceptCompletion }));
  });

  it('binds Space to insert a space and start completions when completion sources are configured', () => {
    render(<CodeEditor value="SELECT" onChange={jest.fn()} completionSources={[jest.fn()]} />);

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

    expect(spaceBinding?.run(view)).toBe(true);
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

  it('loads language extensions lazily when language is provided', async () => {
    const languageExtension = EditorState.languageData.of(() => [{ autocomplete: jest.fn() }]);
    loadLanguageExtensionMock.mockResolvedValue(languageExtension);

    render(<CodeEditor value="" onChange={jest.fn()} language="sql" />);

    await waitFor(() => expect(loadLanguageExtensionMock).toHaveBeenCalledWith('sql'));
    await waitFor(() => expect(getExtensions()).toContain(languageExtension));
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

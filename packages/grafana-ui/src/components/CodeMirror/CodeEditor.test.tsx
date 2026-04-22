import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { render, waitFor } from '@testing-library/react';
import { EditorView } from '@uiw/react-codemirror';

import CodeEditor from './CodeEditor';
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
  };
});

jest.mock('./languageLoader', () => ({
  __esModule: true,
  loadLanguageExtension: jest.fn(),
}));

const autocompletionMock = autocompletion as jest.MockedFunction<typeof autocompletion>;
const loadLanguageExtensionMock = loadLanguageExtension as jest.MockedFunction<typeof loadLanguageExtension>;

const getExtensions = () => capturedProps?.extensions ?? [];

const getAutocompleteSources = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  }).languageDataAt<CompletionSource>('autocomplete', 0);

const getContentAttributes = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  }).facet(EditorView.contentAttributes);

describe('CodeMirror CodeEditor', () => {
  beforeEach(() => {
    capturedProps = undefined;
    autocompletionMock.mockClear();
    loadLanguageExtensionMock.mockClear();
    loadLanguageExtensionMock.mockResolvedValue(null);
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
});

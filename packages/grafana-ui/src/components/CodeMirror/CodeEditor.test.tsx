import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { render } from '@testing-library/react';
import { EditorView } from '@uiw/react-codemirror';

import { CodeEditor } from './CodeEditor';

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

const autocompletionMock = autocompletion as jest.MockedFunction<typeof autocompletion>;

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
});

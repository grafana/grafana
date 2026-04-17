import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { render } from '@testing-library/react';

let capturedProps: { extensions?: unknown[] } | undefined;

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

import { CodeEditor } from './CodeEditor';

const autocompletionMock = autocompletion as jest.MockedFunction<typeof autocompletion>;

const getExtensions = () => capturedProps?.extensions ?? [];

const getAutocompleteSources = () =>
  EditorState.create({
    extensions: getExtensions() as never[],
  }).languageDataAt<CompletionSource>('autocomplete', 0);

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
});

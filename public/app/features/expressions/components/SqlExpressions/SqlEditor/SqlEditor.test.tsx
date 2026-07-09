import { render } from '@testing-library/react';

import { CodeMirrorEditor } from '@grafana/ui/unstable';

import { SqlEditor } from './SqlEditor';

jest.mock('@grafana/ui/unstable', () => ({
  CodeMirrorEditor: jest.fn(() => null),
  signatureHelp: jest.fn(() => []),
}));

const CodeMirrorEditorMock = jest.mocked(CodeMirrorEditor);

describe('SqlEditor', () => {
  beforeEach(() => {
    CodeMirrorEditorMock.mockClear();
  });

  it('renders the SQL language editor, relying on language defaults for keyword completions', () => {
    render(<SqlEditor value="sele" onChange={jest.fn()} />);

    const props = CodeMirrorEditorMock.mock.calls[0][0];
    expect(props.language).toBe('sql');
    // Keyword completions come from the SQL language extension (merge mode), not
    // an override completion source supplied by SqlEditor.
    expect(props.completionMode).not.toBe('override');
  });
});

import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
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

  it('uses upper-case SQL keyword completions', async () => {
    render(<SqlEditor value="sele" onChange={jest.fn()} />);

    expect(CodeMirrorEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        completionMode: 'override',
        completionSources: expect.any(Array),
      }),
      expect.anything()
    );

    const completionSource = CodeMirrorEditorMock.mock.calls[0][0].completionSources?.[0];
    if (!completionSource) {
      throw new Error('Expected SQL keyword completion source');
    }

    const state = EditorState.create({ doc: 'sele' });
    const result = await completionSource(new CompletionContext(state, 4, true));

    expect(result?.options).toContainEqual(expect.objectContaining({ label: 'SELECT', type: 'keyword' }));
  });
});

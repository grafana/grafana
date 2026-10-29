import { render, screen } from '@testing-library/react';

import { CodeMirrorDiffEditor } from './DiffEditorLazy';
import { type CodeMirrorDiffEditorProps } from './types';

let shouldThrowOnRender = false;

const mockDiffEditor = jest.fn((props: CodeMirrorDiffEditorProps) => {
  if (shouldThrowOnRender) {
    throw new Error('Diff editor render failure');
  }

  return <div>{`${props.original} → ${props.modified}`}</div>;
});

jest.mock('./DiffEditor', () => ({
  __esModule: true,
  DiffEditor: (props: CodeMirrorDiffEditorProps) => mockDiffEditor(props),
}));

describe('CodeMirrorDiffEditor lazy wrapper', () => {
  beforeEach(() => {
    shouldThrowOnRender = false;
    mockDiffEditor.mockClear();
  });

  it('shows a loading placeholder and forwards the diff configuration', async () => {
    const props: CodeMirrorDiffEditorProps = {
      original: 'before',
      modified: 'after',
      language: 'json',
      height: '240px',
      inline: true,
      lineNumbers: false,
    };

    render(<CodeMirrorDiffEditor {...props} />);

    expect(screen.getByText('Loading editor')).toBeInTheDocument();
    expect(await screen.findByText('before → after')).toBeInTheDocument();
    expect(mockDiffEditor).toHaveBeenLastCalledWith(props);
  });

  it('shows the error fallback when the diff editor fails to render', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrowOnRender = true;

    try {
      render(<CodeMirrorDiffEditor original="before" modified="after" />);

      expect(await screen.findByText('CodeMirror editor failed to load')).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

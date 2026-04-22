import { render, screen } from '@testing-library/react';

import { CodeMirrorEditor } from './CodeEditorLazy';

let shouldThrowOnRender = false;

const mockCodeEditor = jest.fn(({ value }: { value: string }) => {
  if (shouldThrowOnRender) {
    throw new Error('CodeMirror render failure');
  }

  return <div data-testid="code-mirror-editor">{value}</div>;
});

jest.mock('./CodeEditor', () => ({
  __esModule: true,
  default: (props: { value: string }) => mockCodeEditor(props),
}));

describe('CodeMirrorEditor lazy wrapper', () => {
  beforeEach(() => {
    shouldThrowOnRender = false;
    mockCodeEditor.mockClear();
  });

  it('shows a loading placeholder before rendering the editor', async () => {
    render(<CodeMirrorEditor value="SELECT 1" onChange={jest.fn()} />);

    expect(screen.getByText('Loading editor')).toBeInTheDocument();
    expect(await screen.findByTestId('code-mirror-editor')).toHaveTextContent('SELECT 1');
  });

  it('shows an error boundary fallback when the editor render fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrowOnRender = true;

    render(<CodeMirrorEditor value="" onChange={jest.fn()} />);

    expect(await screen.findByText('CodeMirror editor failed to load')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

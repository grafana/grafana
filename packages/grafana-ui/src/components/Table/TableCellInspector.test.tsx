import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { copyTextToClipboard } from '../../utils/copyToClipboard';
import { type CodeMirrorEditorProps } from '../CodeMirror/types';

import { TableCellInspector, TableCellInspectorDrawer, TableCellInspectorMode } from './TableCellInspector';

jest.mock('../../utils/copyToClipboard', () => ({
  copyTextToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockCodeMirrorEditor = jest.fn(({ value }: CodeMirrorEditorProps) => (
  <div data-testid="code-mirror-editor">{value}</div>
));

jest.mock('../CodeMirror/CodeEditorLazy', () => ({
  CodeMirrorEditor: (props: CodeMirrorEditorProps) => mockCodeMirrorEditor(props),
}));

jest.mock('../Monaco/CodeEditor', () => ({
  CodeEditor: ({ value }: { value: string }) => <div data-testid="monaco-code-editor">{value}</div>,
}));

describe('TableCellInspector', () => {
  beforeEach(() => {
    mockCodeMirrorEditor.mockClear();
  });

  it.each([
    { type: 'string', value: 'simple string' },
    { type: 'number', value: 12345 },
    { type: 'object', value: { key: 'value', anotherKey: 42 } },
    { type: 'array', value: [1, 2, 3, 4, 5] },
    { type: 'null', value: null },
    { type: 'undefined', value: undefined },
  ])('should successfully render for input of type $type', ({ value }) => {
    render(<TableCellInspector value={value} onDismiss={() => {}} mode={TableCellInspectorMode.text} />);
    expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
  });

  it('shows the plain text tab without the formatting applied to the code editor', () => {
    render(
      <TableCellInspector
        value={'{\n  "region": "eu"\n}'}
        plainText={'{"region":"eu"}'}
        onDismiss={() => {}}
        mode={TableCellInspectorMode.text}
      />
    );
    expect(screen.getByText('{"region":"eu"}')).toBeInTheDocument();
  });

  it('keeps the surrounding whitespace of the raw value in the plain text tab', () => {
    render(
      <TableCellInspector
        value={'{\n  "region": "eu"\n}'}
        plainText={'  {"region":"eu"} \n'}
        onDismiss={() => {}}
        mode={TableCellInspectorMode.text}
      />
    );
    expect(screen.getByRole('dialog').querySelector('pre')?.textContent).toBe('  {"region":"eu"} \n');
  });

  it('copies the value of the active tab', async () => {
    const user = userEvent.setup();
    render(
      <TableCellInspector
        value={'{\n  "region": "eu"\n}'}
        plainText={'{"region":"eu"}'}
        onDismiss={() => {}}
        mode={TableCellInspectorMode.text}
      />
    );

    await user.click(screen.getByText('Copy to Clipboard'));
    expect(copyTextToClipboard).toHaveBeenCalledWith('{"region":"eu"}', expect.anything());

    await user.click(screen.getByRole('tab', { name: 'Code editor' }));
    await user.click(screen.getByText('Copy to Clipboard'));
    expect(copyTextToClipboard).toHaveBeenLastCalledWith('{\n  "region": "eu"\n}', expect.anything());
  });

  it('shows the code view in Monaco', () => {
    render(<TableCellInspector value='{"a":1}' onDismiss={() => {}} mode={TableCellInspectorMode.code} />);

    expect(screen.getByTestId('monaco-code-editor')).toHaveTextContent('{"a":1}');
    expect(screen.queryByTestId('code-mirror-editor')).not.toBeInTheDocument();
  });

  describe('with CodeMirror enabled', () => {
    it('shows the code view in a read-only, wrapping JSON CodeMirror editor', () => {
      render(
        <TableCellInspectorDrawer
          value=' {"a":1} '
          onDismiss={() => {}}
          mode={TableCellInspectorMode.code}
          codeMirrorEnabled
        />
      );

      expect(screen.getByTestId('code-mirror-editor')).toHaveTextContent('{"a":1}');
      expect(screen.queryByTestId('monaco-code-editor')).not.toBeInTheDocument();
      expect(mockCodeMirrorEditor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: '{"a":1}',
          language: 'json',
          height: '500px',
          readOnly: true,
          lineWrapping: true,
        })
      );
    });

    it('switches between the plain text and code views', async () => {
      const user = userEvent.setup();
      render(
        <TableCellInspectorDrawer
          value='{"a":1}'
          onDismiss={() => {}}
          mode={TableCellInspectorMode.text}
          codeMirrorEnabled
        />
      );

      expect(screen.queryByTestId('code-mirror-editor')).not.toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Code editor' }));
      expect(screen.getByTestId('code-mirror-editor')).toHaveTextContent('{"a":1}');

      await user.click(screen.getByRole('tab', { name: 'Plain text' }));
      expect(screen.queryByTestId('code-mirror-editor')).not.toBeInTheDocument();
      expect(screen.getByText('{"a":1}')).toBeInTheDocument();
    });
  });
});

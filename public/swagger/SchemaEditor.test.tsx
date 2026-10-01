import { fireEvent, render, screen } from '@testing-library/react';

import type { CodeMirrorEditorProps } from '@grafana/ui/unstable';

import SchemaEditor from './SchemaEditor';

// The schema package pulls ESM-only syntax highlighting into Jest; schema validation
// is outside the draft/commit contract exercised here.
jest.mock('codemirror-json-schema', () => ({
  jsonSchema: () => [],
  getJSONSchema: jest.fn(),
  updateSchema: jest.fn(),
}));

// Keep the editor boundary interactive without depending on CodeMirror's DOM in jsdom.
jest.mock('@grafana/ui/unstable', () => ({
  CodeMirrorEditor: ({ value, readOnly, onChange, onBlur, onSave }: CodeMirrorEditorProps) => (
    <textarea
      aria-label="Request body"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onBlur?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
          onSave?.(event.currentTarget.value);
        }
      }}
    />
  ),
}));

const schema = { type: 'object' };

it('keeps uncommitted text through stale parent rerenders and sends it to Swagger only on blur', () => {
  const onChange = jest.fn();
  const props = { schema, value: '{"old":true}', onChange };
  const { rerender } = render(<SchemaEditor {...props} />);
  const editor = screen.getByRole('textbox', { name: 'Request body' });

  fireEvent.change(editor, { target: { value: '{"draft":1}' } });
  rerender(<SchemaEditor {...props} schema={{ type: 'object', title: 'New schema' }} />);
  expect(editor).toHaveValue('{"draft":1}');
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.change(editor, { target: { value: '{"draft":12}' } });
  fireEvent.blur(editor);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ target: { value: '{"draft":12}' } });

  rerender(<SchemaEditor {...props} />);
  expect(editor).toHaveValue('{"draft":12}');
});

it('saves the current draft and accepts a subsequent external value while editing', () => {
  const onChange = jest.fn();
  const { rerender } = render(<SchemaEditor schema={schema} value="initial" onChange={onChange} />);
  const editor = screen.getByRole('textbox', { name: 'Request body' });

  fireEvent.change(editor, { target: { value: 'unsaved' } });
  fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ target: { value: 'unsaved' } });

  rerender(<SchemaEditor schema={schema} value="unsaved" onChange={onChange} />);
  fireEvent.change(editor, { target: { value: 'new draft' } });
  rerender(<SchemaEditor schema={schema} value="external reset" onChange={onChange} />);
  expect(editor).toHaveValue('external reset');
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('replaces an uncommitted draft when an external default changes', () => {
  const onChange = jest.fn();
  const { rerender } = render(<SchemaEditor schema={schema} defaultValue="first default" onChange={onChange} />);
  const editor = screen.getByRole('textbox', { name: 'Request body' });

  fireEvent.change(editor, { target: { value: 'uncommitted' } });
  rerender(<SchemaEditor schema={schema} defaultValue="next default" onChange={onChange} />);
  expect(editor).toHaveValue('next default');
  expect(onChange).not.toHaveBeenCalled();
});

it.each(['disabled', 'readOnly'] as const)('keeps the draft when %s becomes true', (restriction) => {
  const onChange = jest.fn();
  const props = { schema, value: 'original', onChange };
  const { rerender } = render(<SchemaEditor {...props} />);
  const editor = screen.getByRole('textbox', { name: 'Request body' });

  fireEvent.change(editor, { target: { value: 'draft' } });
  rerender(<SchemaEditor {...props} disabled={restriction === 'disabled'} readOnly={restriction === 'readOnly'} />);
  expect(editor).toHaveValue('draft');
  expect(editor).toHaveAttribute('readonly');
  expect(onChange).not.toHaveBeenCalled();
});

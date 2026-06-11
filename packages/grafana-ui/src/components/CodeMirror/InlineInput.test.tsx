import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CodeMirrorInlineInput, singleLineFilter } from './InlineInput';

describe('singleLineFilter', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function createEditor(text: string) {
    return new EditorView({
      state: EditorState.create({ doc: text, extensions: [singleLineFilter] }),
      parent: container,
    });
  }

  it('rejects inserting a newline (Enter keypress)', () => {
    const view = createEditor('hello');
    view.dispatch({ changes: { from: 5, insert: '\n' } });
    expect(view.state.doc.lines).toBe(1);
    expect(view.state.doc.toString()).toBe('hello');
    view.destroy();
  });

  it('rejects a transaction that would introduce multiple lines', () => {
    const view = createEditor('a');
    view.dispatch({ changes: { from: 1, insert: 'b\nc' } });
    expect(view.state.doc.lines).toBe(1);
    expect(view.state.doc.toString()).toBe('a');
    view.destroy();
  });

  it('allows single-line insertions', () => {
    const view = createEditor('a');
    view.dispatch({ changes: { from: 1, insert: 'bc' } });
    expect(view.state.doc.toString()).toBe('abc');
    view.destroy();
  });
});

describe('CodeMirrorInlineInput', () => {
  it('renders an editable textbox', async () => {
    render(<CodeMirrorInlineInput value="" onChange={jest.fn()} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('applies the placeholder as aria-placeholder', async () => {
    render(<CodeMirrorInlineInput value="" onChange={jest.fn()} placeholder="Enter a URL" />);
    expect(await screen.findByRole('textbox')).toHaveAttribute('aria-placeholder', 'Enter a URL');
  });

  it('forwards aria-labelledby to the editable element', async () => {
    render(<CodeMirrorInlineInput value="" onChange={jest.fn()} aria-labelledby="my-label" />);
    expect(await screen.findByRole('textbox')).toHaveAttribute('aria-labelledby', 'my-label');
  });

  it('places the id on a wrapper whose descendant is the contenteditable (e2e selector contract)', async () => {
    const { container } = render(<CodeMirrorInlineInput id="data-link-input" value="" onChange={jest.fn()} />);
    await screen.findByRole('textbox');
    // Mirrors the e2e selector `#data-link-input [contenteditable="true"]`.
    expect(container.querySelector('#data-link-input [contenteditable="true"]')).not.toBeNull();
  });

  it('renders as a plain field, without line-number or fold gutters', async () => {
    const { container } = render(<CodeMirrorInlineInput value="x" onChange={jest.fn()} />);
    await screen.findByRole('textbox');
    // basicSetup's gutters/line numbers would make this read as a code editor,
    // not a text field.
    expect(container.querySelector('.cm-gutters')).toBeNull();
    expect(container.querySelector('.cm-lineNumbers')).toBeNull();
  });

  it('fires onChange with the typed value', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<CodeMirrorInlineInput value="" onChange={onChange} />);
    const textbox = await screen.findByRole('textbox');
    await user.click(textbox);
    await user.keyboard('abc');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).not.toContain('\n');
  });
});

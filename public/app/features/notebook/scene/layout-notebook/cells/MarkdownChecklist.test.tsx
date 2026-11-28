import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor } from 'test/test-utils';

import { MarkdownCell } from './MarkdownCell';
import { MarkdownCellEditor } from './MarkdownCellEditor';

describe('notebook checklists', () => {
  it('converts [] followed by Space into a checklist and keeps the caret ready for typing', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text: '[]' } }} onChange={onChange} />
    );
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => {
      view.dispatch({ selection: { anchor: 2 } });
      view.focus();
    });
    await user.keyboard(' Check logs');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '- [ ] Check logs' } });
    expect(screen.getByRole('checkbox', { name: 'Check logs' })).not.toBeChecked();
  });

  it.each(['Use []', '```\n[]', '    []'])('preserves literal brackets in %s when Space is pressed', async (text) => {
    const onChange = jest.fn();
    const { user } = render(<MarkdownCellEditor content={{ kind: 'Markdown', spec: { text } }} onChange={onChange} />);
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => {
      view.dispatch({ selection: { anchor: text.length } });
      view.focus();
    });
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: text + ' ' } });
  });

  it('emits checked Markdown and restores its saved state when reopened', async () => {
    const onChange = jest.fn();
    const { user, unmount } = render(
      <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text: '- [ ] Check logs' } }} onChange={onChange} />
    );

    await user.click(await screen.findByRole('checkbox'));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '- [x] Check logs' } })
    );
    unmount();

    render(<MarkdownCellEditor content={onChange.mock.lastCall[0]} onChange={onChange} />);
    expect(await screen.findByRole('checkbox')).toBeChecked();
  });

  it('continues a checked task in the same cell when Enter is pressed', async () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    render(
      <MarkdownCellEditor
        content={{ kind: 'Markdown', spec: { text: '- [x] Check logs' } }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
    fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '- [x] Check logs\n- [ ] ' } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'Shift-Enter'])('preserves nested checklist indentation on %s', async (key) => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const text = '- [ ] Parent\n  - [x] Child';
    render(
      <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text } }} onChange={onChange} onSubmit={onSubmit} />
    );
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => view.dispatch({ selection: { anchor: text.length } }));
    fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: key === 'Shift-Enter' });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'Markdown',
      spec: { text: '- [ ] Parent\n  - [x] Child\n  - [ ] ' },
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ticks a focused checkbox with Space', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text: '- [ ] Check logs' } }} onChange={onChange} />
    );
    const checkbox = await screen.findByRole('checkbox');
    act(() => checkbox.focus());
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '- [x] Check logs' } });
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(checkbox).toHaveFocus();
  });

  it('returns to text after pointer ticking so Space types and Enter continues the checklist', async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const { user } = render(
      <MarkdownCellEditor
        content={{ kind: 'Markdown', spec: { text: '- [ ] Check logs' } }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    await user.click(await screen.findByRole('checkbox'));
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveFocus();
    await user.keyboard(' now{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'Markdown',
      spec: { text: '- [x] Check logs now\n- [ ] ' },
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'Shift-Enter'])('exits an empty checklist on %s', async (key) => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    render(
      <MarkdownCellEditor
        content={{ kind: 'Markdown', spec: { text: '- [ ] ' } }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
    fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: key === 'Shift-Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'Markdown', spec: { text: '' } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps saved checkboxes disabled in reading mode', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <MarkdownCell
        content={{ kind: 'Markdown', spec: { text: '- [x] Check logs\n- [ ] Check traces' } }}
        isEditing={false}
        onChange={onChange}
      />
    );
    const [checked, unchecked] = await screen.findAllByRole('checkbox');
    expect(checked).toBeChecked();
    expect(unchecked).not.toBeChecked();
    expect(checked).toBeDisabled();
    expect(unchecked).toBeDisabled();
    await user.click(unchecked);
    expect(onChange).not.toHaveBeenCalled();
  });
});

it.each(['Enter', 'Shift-Enter'])('exits after a populated task with %s', async (key) => {
  const text = '- [ ] Check logs';
  const onSubmit = jest.fn();
  render(
    <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text } }} onChange={jest.fn()} onSubmit={onSubmit} />
  );
  const editor = await screen.findByRole('textbox', { name: 'Markdown' });
  const view = EditorView.findFromDOM(editor)!;
  act(() => view.dispatch({ selection: { anchor: text.length } }));
  fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: key === 'Shift-Enter' });
  fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: key === 'Shift-Enter' });
  expect(view.state.doc.toString()).toBe('- [ ] Check logs\n');
});

describe.each(['**', '*', '`', '~~'])('closing %s markers', (marker) => {
  it.each(['Enter', 'Shift-Enter'])('preserves closing markers on %s', async (key) => {
    const text = '- [ ] ' + marker + 'Check logs' + marker;
    render(
      <MarkdownCellEditor content={{ kind: 'Markdown', spec: { text } }} onChange={jest.fn()} onSubmit={jest.fn()} />
    );
    const editor = await screen.findByRole('textbox', { name: 'Markdown' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => view.dispatch({ selection: { anchor: text.length - marker.length } }));
    fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: key === 'Shift-Enter' });
    expect(view.state.doc.toString()).toBe(text + '\n- [ ] ');
  });
});

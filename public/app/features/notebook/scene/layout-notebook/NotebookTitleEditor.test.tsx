import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { NotebookTitleEditor } from './NotebookTitleEditor';

const TITLE = 'Q2 latency regression';

/** Controlled, the way the scene above it is: what this field reports comes back down as `title`. */
function ControlledEditor({ initialTitle, onChange }: { initialTitle: string; onChange: (title: string) => void }) {
  const [title, setTitle] = useState(initialTitle);

  return (
    <NotebookTitleEditor
      title={title}
      onChange={(next) => {
        setTitle(next);
        onChange(next);
      }}
    />
  );
}

function setup(initialTitle = TITLE) {
  const onChange = jest.fn();
  const rendered = render(<ControlledEditor initialTitle={initialTitle} onChange={onChange} />);

  return { ...rendered, onChange };
}

function getTrigger() {
  return screen.getByRole('button', { name: 'Edit title' });
}

function getInput() {
  return screen.getByRole('textbox', { name: 'Title' });
}

function ancestorsOf(element: HTMLElement) {
  const ancestors: HTMLElement[] = [];
  for (let current = element.parentElement; current && current !== document.body; current = current.parentElement) {
    ancestors.push(current);
  }
  return ancestors;
}

describe('NotebookTitleEditor', () => {
  it('is a heading, and the heading itself is the way in', () => {
    setup();

    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(getTrigger()).toBeInTheDocument();
  });

  it('opens a field holding the title, with the text already selected', async () => {
    const { user } = setup();

    await user.click(getTrigger());

    const input = getInput();
    expect(input).toHaveValue(TITLE);
    expect(input).toHaveFocus();
    expect(input).toHaveProperty('selectionStart', 0);
    expect(input).toHaveProperty('selectionEnd', TITLE.length);
  });

  // Autosave stops counting once edit mode is left, which can happen without this field ever blurring.
  it('reports every keystroke rather than waiting for the field to close', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), 'Q3');

    expect(onChange.mock.calls.map(([title]) => title)).toEqual(['Q', 'Q3']);
  });

  it('closes back to a heading on blur', async () => {
    const { user } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), 'Q3 latency regression');
    await user.click(document.body);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  it('closes back to a heading on Enter', async () => {
    const { user } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), 'Q3 latency regression{enter}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  it('reports nothing while the field is empty, and will not close on it', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.click(document.body);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter a title')).toBeInTheDocument();
    expect(getInput()).toBeInTheDocument();
  });

  it('takes the next title typed after an empty one, and closes on it', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.click(document.body);
    await user.type(getInput(), 'Q3 latency regression{enter}');

    expect(onChange).toHaveBeenLastCalledWith('Q3 latency regression');
    expect(screen.queryByText('Please enter a title')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  // Every keystroke has been reported by now, so Escape has to put the old title back, not just stop.
  it('puts back the title the edit started from on Escape', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), 'Q3 latency regression');
    await user.keyboard('{Escape}');

    expect(onChange).toHaveBeenLastCalledWith(TITLE);
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
  });

  // The keystroke path refuses to report an empty title; Escape has to follow the same rule, or
  // cancelling an edit that started untitled hands the notebook its emptiness back.
  it('keeps the typed title on Escape when the edit started from an empty one', async () => {
    const { user, onChange } = setup('');

    await user.click(getTrigger());
    await user.type(getInput(), 'Q3 latency regression');
    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalledWith('');
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  // Edit mode can be left without the field ever closing, so trimming on close alone saves the padding.
  it('trims the title it reports before the field is closed', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), '  Q3  ');

    expect(onChange).toHaveBeenLastCalledWith('Q3');
    expect(getInput()).toBeInTheDocument();
  });

  it('trims the title it settles on', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), '  Q3 latency regression  {enter}');

    expect(onChange).toHaveBeenLastCalledWith('Q3 latency regression');
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  it('still offers something to click when the notebook has no title', async () => {
    const { user } = setup('');

    expect(screen.getByRole('heading', { name: 'Add a title' })).toBeInTheDocument();

    await user.click(getTrigger());

    expect(getInput()).toHaveValue('');
    expect(screen.queryByText('Please enter a title')).not.toBeInTheDocument();
  });

  // The header stacks this in a column aligned to flex-start, which shrink-wraps whatever it holds.
  it('gives the open field the whole line rather than letting it shrink to content', async () => {
    const { user } = setup();

    await user.click(getTrigger());
    // The field wrapper specifically: Input brings a full-width wrapper of its own, so "some ancestor
    // fills the line" would hold either way.
    const field = ancestorsOf(getInput()).find((element) => element.contains(screen.getByText('Title')));

    expect(field).toHaveStyle({ width: '100%' });
  });

  it('shows a title replaced from elsewhere while the field is closed', () => {
    const { rerender } = render(<NotebookTitleEditor title={TITLE} onChange={jest.fn()} />);

    rerender(<NotebookTitleEditor title="Rebuilt" onChange={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Rebuilt' })).toBeInTheDocument();
  });
});

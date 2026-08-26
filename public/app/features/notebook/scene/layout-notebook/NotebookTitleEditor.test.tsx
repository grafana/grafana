import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { NotebookTitleEditor } from './NotebookTitleEditor';

const TITLE = 'Q2 latency regression';

/**
 * Controlled, the way the layout manager and the scene above it are: every keystroke this field
 * reports comes straight back down as the next `title`. An uncontrolled spy would let the two drift
 * and hide whatever the round trip does to the caret.
 */
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

/** Every element between `element` and the document body, nearest first. */
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

    // The heading keeps the notebook's name while the control that opens it says what it does: the
    // button's `title` names the button alone, and the h1 still computes its own name from the text.
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(getTrigger()).toBeInTheDocument();
  });

  it('opens a field holding the title, with the text already selected', async () => {
    const { user } = setup();

    await user.click(getTrigger());

    const input = getInput();
    expect(input).toHaveValue(TITLE);
    expect(input).toHaveFocus();
    // Selected so the usual gesture — replacing "New notebook" wholesale — takes one keystroke.
    expect(input).toHaveProperty('selectionStart', 0);
    expect(input).toHaveProperty('selectionEnd', TITLE.length);
  });

  // The behaviour the whole arrangement turns on. Autosave stops counting changes the moment the
  // notebook leaves edit mode, and it can leave without this field ever blurring, so a title held
  // back until blur would reach the scene too late to be written.
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

  // The scene's title is required, and autosave would write the notebook nameless. Nothing blocks the
  // emptying itself — the last real title is simply never given up.
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

  // Every keystroke has already been reported by this point, so Escape has to put the old title back
  // rather than merely stop reporting a new one.
  it('puts back the title the edit started from on Escape', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), 'Q3 latency regression');
    await user.keyboard('{Escape}');

    expect(onChange).toHaveBeenLastCalledWith(TITLE);
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
  });

  it('trims the title it settles on', async () => {
    const { user, onChange } = setup();

    await user.click(getTrigger());
    await user.clear(getInput());
    await user.type(getInput(), '  Q3 latency regression  {enter}');

    expect(onChange).toHaveBeenLastCalledWith('Q3 latency regression');
    expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
  });

  // A notebook whose title was emptied elsewhere would otherwise have nothing to click, and so no way
  // back to a title at all.
  it('still offers something to click when the notebook has no title', async () => {
    const { user } = setup('');

    expect(screen.getByRole('heading', { name: 'Add a title' })).toBeInTheDocument();

    await user.click(getTrigger());

    expect(getInput()).toHaveValue('');
    // Not nagged before they have had a chance to type.
    expect(screen.queryByText('Please enter a title')).not.toBeInTheDocument();
  });

  // The field takes its width from whatever it is dropped into, which no type or snapshot protects:
  // the document header stacks it in a column aligned to flex-start, so a row that shrink-wraps leaves
  // the field at the browser's default input size instead of on the line the heading had.
  it('gives the open field the whole line rather than letting it shrink to content', async () => {
    const { user } = setup();

    await user.click(getTrigger());
    // The field wrapper specifically — the one element holding both the label and the input. Input
    // brings a full-width wrapper of its own, so "some ancestor fills the line" would hold either way.
    const field = ancestorsOf(getInput()).find((element) => element.contains(screen.getByText('Title')));

    expect(field).toHaveStyle({ width: '100%' });
  });

  it('shows a title replaced from elsewhere while the field is closed', () => {
    const { rerender } = render(<NotebookTitleEditor title={TITLE} onChange={jest.fn()} />);

    rerender(<NotebookTitleEditor title="Rebuilt" onChange={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Rebuilt' })).toBeInTheDocument();
  });
});

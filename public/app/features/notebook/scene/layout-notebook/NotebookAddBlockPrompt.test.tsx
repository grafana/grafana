import { render, screen } from 'test/test-utils';

import { NotebookAddBlockPrompt } from './NotebookAddBlockPrompt';

const PROMPT = /type to start writing/i;

describe('NotebookAddBlockPrompt', () => {
  it('renders the prompt as a menu button', () => {
    render(<NotebookAddBlockPrompt index={0} />);

    // The visible copy is the accessible name — no aria-label overrides it, so a speech-input user can
    // say what they can read. aria-haspopup carries the 'this opens a menu' part instead.
    expect(screen.getByRole('button', { name: PROMPT })).toHaveAttribute('aria-haspopup', 'menu');
  });

  // The one behavioural pin on the append index: the layout manager passes cells.length, and an
  // off-by-one here would insert before the last cell once edit mode wires onAdd up.
  it('adds at the index it was given', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookAddBlockPrompt index={2} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: PROMPT }));
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 2);
  });
});

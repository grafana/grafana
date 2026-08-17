import { render, screen } from 'test/test-utils';

import { NotebookAddBlockPrompt } from './NotebookAddBlockPrompt';

const PROMPT = /type to start writing/i;

describe('NotebookAddBlockPrompt', () => {
  it('renders the prompt as a menu button', () => {
    render(<NotebookAddBlockPrompt index={0} />);
    expect(screen.getByRole('button', { name: PROMPT })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('adds at the index it was given', async () => {
    const onAdd = jest.fn();
    const { user } = render(<NotebookAddBlockPrompt index={2} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: PROMPT }));
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 2);
  });
});

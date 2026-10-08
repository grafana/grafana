import { render, screen } from 'test/test-utils';

import { NotebookBlockTypeMenu } from './NotebookBlockTypeMenu';

describe('NotebookBlockTypeMenu', () => {
  it('opens with focus on the first block type', () => {
    render(<NotebookBlockTypeMenu />);

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('jumps to the block type matching a typed letter', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('v');
    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();

    await user.keyboard('H');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('leaves focus in place when no block type matches', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('z');

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('moves down and up with Ctrl+N and Ctrl+P, wrapping at the ends', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveFocus();

    await user.keyboard('{Control>}p{/Control}{Control>}p{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();
  });

  // With Caps Lock on, event.key is uppercase; missing that would let Ctrl+P open the print dialog.
  it('handles Ctrl+N/P with Caps Lock on', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('{CapsLock}{Control>}n{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveFocus();

    await user.keyboard('{Control>}p{/Control}');
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('wraps forward from the last block type with Ctrl+N', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('v{Control>}n{/Control}');

    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveFocus();
  });

  it('picks the focused block type with Enter after Ctrl+N/P', async () => {
    const onPick = jest.fn();
    const { user } = render(<NotebookBlockTypeMenu onPick={onPick} />);

    await user.keyboard('{Control>}n{/Control}{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('paragraph');

    await user.keyboard('{Control>}p{/Control}{Control>}p{/Control}{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('visualization');
  });

  // Focus moves through Menu's own index; focusing an item directly would desync it and the next
  // arrow press would step from the item focused before the jump.
  it('continues arrow navigation from the item a letter jumped to', async () => {
    const { user } = render(<NotebookBlockTypeMenu />);

    await user.keyboard('c');
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveFocus();
  });

  it('picks the focused block type with Enter after a letter jump', async () => {
    const onPick = jest.fn();
    const { user } = render(<NotebookBlockTypeMenu onPick={onPick} />);

    await user.keyboard('c{Enter}');

    expect(onPick).toHaveBeenCalledWith('code');
  });
});

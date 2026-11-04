import { render, screen } from 'test/test-utils';

import { canCreateNotebooks } from '../permissions';

import { ScratchpadPanel } from './ScratchpadPanel';
import { promoteScratchpad } from './promoteScratchpad';
import { isScratchpadOpen } from './scratchpadOpen';
import { addNote, clearScratchpad, getScratchpad } from './scratchpadStore';

jest.mock('../permissions', () => ({ canCreateNotebooks: jest.fn(() => true) }));
jest.mock('./promoteScratchpad', () => ({ promoteScratchpad: jest.fn() }));

describe('ScratchpadPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearScratchpad();
    jest.mocked(canCreateNotebooks).mockReturnValue(true);
    jest.mocked(promoteScratchpad).mockReset();
  });

  it('adds a note from the composer', async () => {
    const { user } = render(<ScratchpadPanel onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Add a note'), 'first thought');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(getScratchpad().blocks).toEqual([expect.objectContaining({ text: 'first thought' })]);
    expect(screen.getByDisplayValue('first thought')).toBeInTheDocument();
  });

  it('flips a text block to a heading', async () => {
    addNote('Section');
    const { user } = render(<ScratchpadPanel onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Make heading' }));

    expect(getScratchpad().blocks[0]).toMatchObject({ text: '# Section' });
  });

  it('removes a block', async () => {
    addNote('gone');
    const { user } = render(<ScratchpadPanel onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Remove block' }));

    expect(getScratchpad().blocks).toEqual([]);
  });

  it('disables saving when empty or without permission to create', () => {
    const { unmount } = render(<ScratchpadPanel onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Save as notebook' })).toBeDisabled();
    unmount();

    addNote('x');
    jest.mocked(canCreateNotebooks).mockReturnValue(false);
    render(<ScratchpadPanel onClose={jest.fn()} />);
    // With a tooltip the button reports aria-disabled so the tooltip stays reachable.
    expect(screen.getByRole('button', { name: 'Save as notebook' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('saves as a notebook and closes', async () => {
    jest.mocked(promoteScratchpad).mockResolvedValue('nb-1');
    addNote('x');
    const onClose = jest.fn();
    const { user } = render(<ScratchpadPanel onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Save as notebook' }));

    expect(promoteScratchpad).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the error and keeps the panel open when saving fails', async () => {
    jest.mocked(promoteScratchpad).mockRejectedValue(new Error('nope'));
    addNote('x');
    const onClose = jest.fn();
    const { user } = render(<ScratchpadPanel onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Save as notebook' }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('marks itself open while mounted', () => {
    const { unmount } = render(<ScratchpadPanel onClose={jest.fn()} />);
    expect(isScratchpadOpen()).toBe(true);

    unmount();
    expect(isScratchpadOpen()).toBe(false);
  });

  it('asks before discarding the draft', async () => {
    addNote('keep');
    const { user } = render(<ScratchpadPanel onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Discard scratchpad' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(getScratchpad().blocks).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Discard scratchpad' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(getScratchpad().blocks).toEqual([]);
  });
});

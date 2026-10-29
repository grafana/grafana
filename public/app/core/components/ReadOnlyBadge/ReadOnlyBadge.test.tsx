import { render, screen, within } from 'test/test-utils';

import { ReadOnlyBadge } from './ReadOnlyBadge';

describe('ReadOnlyBadge', () => {
  it('shows the read only text and explains why on hover', async () => {
    const { user } = render(<ReadOnlyBadge tooltip="You can't change this" />);

    await user.hover(screen.getByText('Read only'));
    expect(await screen.findByText("You can't change this")).toBeInTheDocument();
  });

  it('shows only a labelled padlock when compact, and explains why on hover', async () => {
    const { user } = render(<ReadOnlyBadge compact tooltip="You can't change this" />);

    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    const badge = screen.getByRole('img', { name: 'Read only' });
    expect(within(badge).getByTestId('icon-lock')).toBeInTheDocument();

    await user.hover(badge);
    expect(await screen.findByText("You can't change this")).toBeInTheDocument();
  });
});

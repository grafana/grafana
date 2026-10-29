import { render, screen } from 'test/test-utils';

import { ReadOnlyBadge } from './ReadOnlyBadge';

describe('ReadOnlyBadge', () => {
  it('shows the read only text and explains why on hover', async () => {
    const { user } = render(<ReadOnlyBadge tooltip="You can't change this" />);

    await user.hover(screen.getByText('Read only'));
    expect(await screen.findByText("You can't change this")).toBeInTheDocument();
  });

  it('shows only a labelled padlock when compact', () => {
    render(<ReadOnlyBadge compact tooltip="You can't change this" />);

    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Read only' })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReadOnlyBadge } from './ReadOnlyBadge';

describe('ReadOnlyBadge', () => {
  it('renders the read-only badge with the git tooltip by default', async () => {
    const user = userEvent.setup();
    render(<ReadOnlyBadge />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
    await user.hover(screen.getByText('Read only'));
    expect(await screen.findByText(/provisioned through Git/i)).toBeInTheDocument();
  });

  it('renders the local file-provisioning tooltip when isLocal is set', async () => {
    const user = userEvent.setup();
    render(<ReadOnlyBadge isLocal />);

    await user.hover(screen.getByText('Read only'));
    expect(await screen.findByText(/provisioned through file provisioning/i)).toBeInTheDocument();
  });
});

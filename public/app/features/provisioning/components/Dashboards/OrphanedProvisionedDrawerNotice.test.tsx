import { render, screen, userEvent } from 'test/test-utils';

import { OrphanedProvisionedDrawerNotice } from './OrphanedProvisionedDrawerNotice';

describe('OrphanedProvisionedDrawerNotice', () => {
  it('should explain orphan state and call onDismiss when Close is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    render(<OrphanedProvisionedDrawerNotice onDismiss={onDismiss} />);

    expect(screen.getByText('Provisioning repository no longer exists')).toBeInTheDocument();
    expect(
      screen.getByText(/Use the warning at the top of the dashboard/i, { exact: false })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

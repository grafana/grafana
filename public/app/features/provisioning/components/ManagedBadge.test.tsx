import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ManagerKind } from 'app/features/apiserver/types';

import { ManagedBadge } from './ManagedBadge';

describe('ManagedBadge', () => {
  it('renders the repository variant with the repository name in the tooltip', async () => {
    const user = userEvent.setup();
    render(<ManagedBadge managerKind={ManagerKind.Repo} name="My Repo" />);

    const badge = screen.getByTestId('icon-exchange-alt');
    await user.hover(badge);
    expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
  });

  it('renders a generic repository tooltip when no name is provided', async () => {
    const user = userEvent.setup();
    render(<ManagedBadge managerKind={ManagerKind.Repo} />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Managed by: Repository')).toBeInTheDocument();
  });

  it('renders the orphaned repository state', async () => {
    const user = userEvent.setup();
    render(<ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />);

    const badge = screen.getByTestId('icon-exclamation-triangle');
    expect(badge).toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();

    await user.hover(badge);
    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it.each([
    [ManagerKind.Terraform, 'Managed by: Terraform'],
    [ManagerKind.Kubectl, 'Managed by: Kubectl'],
    [ManagerKind.ClassicFP, 'Managed by: File provisioning'],
  ])('renders the %s variant', async (managerKind, expectedTooltip) => {
    const user = userEvent.setup();
    render(<ManagedBadge managerKind={managerKind} />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
  });

  it('renders the plugin variant including the plugin id', async () => {
    const user = userEvent.setup();
    render(<ManagedBadge managerKind={ManagerKind.Plugin} name="my-app" />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Managed by: Plugin my-app')).toBeInTheDocument();
  });

  it('renders a generic "Provisioned" badge when the manager kind is omitted/unknown', async () => {
    const user = userEvent.setup();
    render(<ManagedBadge />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });
});

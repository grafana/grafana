import { render, screen } from 'test/test-utils';

import { type Connection } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { ConnectionListItem } from './ConnectionListItem';

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  metadata: { name: 'test-connection' },
  spec: {
    title: 'Test Connection',
    type: 'github',
    url: 'https://github.com/settings/installations/12345678',
    github: { appID: '123456', installationID: '12345678' },
  },
  ...overrides,
});

const managedConnection = () =>
  createMockConnection({
    metadata: {
      name: 'test-connection',
      annotations: {
        [AnnoKeyManagerKind]: ManagerKind.Terraform,
        [AnnoKeyManagerIdentity]: 'terraform',
      },
    },
  });

describe('ConnectionListItem', () => {
  it('renders the View action', () => {
    render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
  });

  it('does not render actions in selection mode (onClick provided)', () => {
    render(<ConnectionListItem connection={createMockConnection()} onClick={jest.fn()} />, { renderWithRouter: true });

    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });

  it('shows the managed badge for an externally managed connection', () => {
    render(<ConnectionListItem connection={managedConnection()} />, { renderWithRouter: true });

    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('names the owning plugin in the badge tooltip, not the connection', async () => {
    const connection = createMockConnection({
      metadata: {
        name: 'test-connection',
        annotations: {
          [AnnoKeyManagerKind]: ManagerKind.Plugin,
          [AnnoKeyManagerIdentity]: 'grafana-slo-app',
        },
      },
    });
    const { user } = render(<ConnectionListItem connection={connection} />, { renderWithRouter: true });

    await user.hover(screen.getByTestId('icon-exchange-alt'));

    expect(await screen.findByText('Managed by: Plugin grafana-slo-app')).toBeInTheDocument();
  });

  it('does not show the managed badge for an unmanaged connection', () => {
    render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });
});

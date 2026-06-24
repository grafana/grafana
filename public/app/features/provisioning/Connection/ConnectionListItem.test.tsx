import { render, screen } from 'test/test-utils';

import { type Connection } from 'app/api/clients/provisioning/v0alpha1';

import { exportResourceAsJson } from '../utils/export';

import { ConnectionListItem } from './ConnectionListItem';

jest.mock('../utils/export', () => ({ exportResourceAsJson: jest.fn() }));

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

describe('ConnectionListItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders View and Export actions', () => {
    render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('exports the connection as JSON when the Export button is clicked', async () => {
    const connection = createMockConnection();
    const { user } = render(<ConnectionListItem connection={connection} />, { renderWithRouter: true });

    await user.click(screen.getByRole('button', { name: /export/i }));

    expect(exportResourceAsJson).toHaveBeenCalledWith(connection, 'Connection');
  });

  it('does not render actions in selection mode (onClick provided)', () => {
    render(<ConnectionListItem connection={createMockConnection()} onClick={jest.fn()} />, { renderWithRouter: true });

    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });
});

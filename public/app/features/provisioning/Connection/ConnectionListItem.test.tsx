import saveAs from 'file-saver';
import { render, screen } from 'test/test-utils';

import { type Connection } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { ConnectionListItem } from './ConnectionListItem';

jest.mock('file-saver', () => jest.fn());

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
  beforeEach(() => jest.clearAllMocks());

  it('renders the View action', () => {
    render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
  });

  it('does not render actions in selection mode (onClick provided)', () => {
    render(<ConnectionListItem connection={createMockConnection()} onClick={jest.fn()} />, { renderWithRouter: true });

    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  it('downloads the connection as a Connection manifest named after it', async () => {
    const { user } = render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    await user.click(screen.getByRole('button', { name: /export/i }));

    const [blob, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toBe('test-connection.json');
    expect(JSON.parse(await (blob as Blob).text())).toMatchObject({
      kind: 'Connection',
      metadata: { name: 'test-connection' },
      spec: { title: 'Test Connection', github: { appID: '123456' } },
    });
  });

  it('replaces a configured secret with a create placeholder in the downloaded manifest', async () => {
    const connection = createMockConnection({ secure: { privateKey: { name: 'enc-private-key-ref' } } });
    const { user } = render(<ConnectionListItem connection={connection} />, { renderWithRouter: true });

    await user.click(screen.getByRole('button', { name: /export/i }));

    const [blob] = jest.mocked(saveAs).mock.calls[0];
    const text = await (blob as Blob).text();
    expect(JSON.parse(text).secure).toEqual({ privateKey: { create: '<replace-with-privateKey>' } });
    expect(text).not.toContain('enc-private-key-ref');
  });

  it('keeps Export available on an externally managed connection', async () => {
    const { user } = render(<ConnectionListItem connection={managedConnection()} />, { renderWithRouter: true });

    await user.click(screen.getByRole('button', { name: /export/i }));

    expect(jest.mocked(saveAs)).toHaveBeenCalledTimes(1);
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

  it('badges a connection provisioned by a repository read-only', () => {
    const connection = managedConnection();
    connection.metadata!.annotations = {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeyManagerIdentity]: 'bootstrap',
    };

    render(<ConnectionListItem connection={connection} />, { renderWithRouter: true });

    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('shows the managed badge for a connection provisioned by a repository', () => {
    const connection = managedConnection();
    connection.metadata!.annotations = {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeyManagerIdentity]: 'bootstrap',
    };

    render(<ConnectionListItem connection={connection} />, { renderWithRouter: true });

    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not show the managed badge for an unmanaged connection', () => {
    render(<ConnectionListItem connection={createMockConnection()} />, { renderWithRouter: true });

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });
});

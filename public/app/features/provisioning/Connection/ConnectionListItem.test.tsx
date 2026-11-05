import saveAs from 'file-saver';
import { render, screen } from 'test/test-utils';

import { type Connection } from 'app/api/clients/provisioning/v0alpha1';

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

describe('ConnectionListItem', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('does not render the Export action in selection mode', () => {
    render(<ConnectionListItem connection={createMockConnection()} onClick={jest.fn()} />, { renderWithRouter: true });

    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });
});

import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Connection, type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { ConfigForm } from './ConfigForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const gitlabConnection: Connection = {
  metadata: { name: 'gitlab-conn' },
  spec: { type: 'gitlabOAuth', title: 'GitLab OAuth' },
  status: {
    observedGeneration: 1,
    health: { healthy: true, checked: 2 },
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'Available',
        message: '',
        lastTransitionTime: '2024-01-01T00:00:00Z',
      },
    ],
  },
};

function buildRepository(withConnection: boolean, connectionName = 'gitlab-conn'): Repository {
  return {
    metadata: { name: 'repo-1' },
    spec: {
      type: 'gitlab',
      title: 'Test',
      sync: { enabled: false, target: 'folder', intervalSeconds: 60 },
      workflows: [],
      gitlab: { url: 'https://gitlab.com/g/r', branch: 'main' },
      ...(withConnection ? { connection: { name: connectionName } } : {}),
    },
  };
}

function setup(data: Repository) {
  server.use(http.get(`${BASE}/connections`, () => HttpResponse.json({ items: [gitlabConnection] })));
  return render(<ConfigForm data={data} />);
}

describe('ConfigForm', () => {
  it('shows the connection selector instead of token fields for connection-backed repositories', async () => {
    setup(buildRepository(true));

    expect(await screen.findByText('Connection')).toBeInTheDocument();
    expect(screen.queryByText(/Project Access Token/)).not.toBeInTheDocument();
  });

  it('shows the token field and no connection selector for PAT-based repositories', async () => {
    setup(buildRepository(false));

    expect(await screen.findByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.queryByText('Connection')).not.toBeInTheDocument();
  });

  it('offers replacement connections for the provider when the referenced connection is missing', async () => {
    mockComboboxRect();
    const { user } = setup(buildRepository(true, 'gone-conn'));

    expect(await screen.findByText('Connection')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Connection/ }));
    expect(await screen.findByRole('option', { name: /GitLab OAuth/ })).toBeInTheDocument();
  });
});

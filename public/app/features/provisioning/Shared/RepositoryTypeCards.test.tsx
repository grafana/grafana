import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { setupProvisioningMswServer } from '../mocks/server';

import { RepositoryTypeCards } from './RepositoryTypeCards';

setupProvisioningMswServer();

describe('RepositoryTypeCards', () => {
  it('offers the Source API type when the backend makes it available', async () => {
    server.use(
      http.get(`${BASE}/settings`, () =>
        HttpResponse.json({ availableRepositoryTypes: ['github', 'local', 'source'], items: [] })
      )
    );
    render(<RepositoryTypeCards />);

    const sourceCard = await screen.findByRole('link', { name: /Configure with Source API/ });
    expect(sourceCard).toHaveAttribute('href', '/admin/provisioning/connect/source');
    expect(screen.getByRole('link', { name: /Configure file provisioning/ })).toBeInTheDocument();
  });

  it('hides the Source API type when the backend does not offer it', async () => {
    server.use(
      http.get(`${BASE}/settings`, () =>
        HttpResponse.json({ availableRepositoryTypes: ['github', 'local'], items: [] })
      )
    );
    render(<RepositoryTypeCards />);

    expect(await screen.findByRole('link', { name: /Configure with GitHub/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Source API/ })).not.toBeInTheDocument();
  });
});

import { render, screen } from 'test/test-utils';

import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { RepositoryActions } from './RepositoryActions';

setupProvisioningMswServer();

const repository: Repository = {
  metadata: { name: 'test-repo' },
  spec: { title: 'Test Repository', type: 'github', sync: { target: 'folder', enabled: true }, workflows: [] },
};

describe('RepositoryActions', () => {
  it('links View folder to the repository folder for a folder target', () => {
    render(<RepositoryActions repository={repository} />);

    expect(screen.getByRole('link', { name: 'View folder' })).toHaveAttribute('href', '/dashboards/f/test-repo');
  });
});

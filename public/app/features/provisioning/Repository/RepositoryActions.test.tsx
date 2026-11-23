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

  it('badges the save workflows next to the status', async () => {
    const { user } = render(
      <RepositoryActions
        repository={{
          metadata: { name: 'test-repo' },
          spec: {
            title: 'Test Repository',
            type: 'github',
            sync: { target: 'folder', enabled: true },
            workflows: ['write', 'branch'],
            github: { url: 'https://github.com/o/r', branch: 'main' },
          },
        }}
      />
    );

    expect(screen.getByText('Direct push')).toBeInTheDocument();
    await user.hover(screen.getByText('Pull request'));
    expect(
      await screen.findByText('Changes are saved to another branch, ready for you to open a pull request into main.')
    ).toBeInTheDocument();
  });

  it('badges a repository with no workflows as read only', () => {
    render(<RepositoryActions repository={repository} />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});

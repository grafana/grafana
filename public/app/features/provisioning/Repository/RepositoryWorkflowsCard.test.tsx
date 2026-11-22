import { render, screen } from 'test/test-utils';

import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { createRepository } from '../mocks/factories';

import { RepositoryWorkflowsCard } from './RepositoryWorkflowsCard';

function renderCard(workflows: Array<'write' | 'branch'>): Repository {
  const repo = createRepository({ spec: { workflows, github: { url: 'https://github.com/o/r', branch: 'main' } } });
  render(<RepositoryWorkflowsCard repo={repo} />);
  return repo;
}

describe('RepositoryWorkflowsCard', () => {
  it('marks both tiles not enabled and explains read-only when there are no workflows', () => {
    renderCard([]);

    expect(screen.getAllByText('Not enabled')).toHaveLength(2);
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
    expect(screen.getByText(/can't save changes here/)).toBeInTheDocument();
  });

  it('enables only the direct push tile for write', () => {
    renderCard(['write']);

    expect(screen.getByText('Changes are pushed directly to main.')).toBeInTheDocument();
    expect(screen.getAllByText('Enabled')).toHaveLength(1);
    expect(screen.getAllByText('Not enabled')).toHaveLength(1);
    expect(screen.queryByText(/can't save changes here/)).not.toBeInTheDocument();
  });

  it('enables only the pull request tile for branch', () => {
    renderCard(['branch']);

    expect(screen.getByText(/proposed as a pull request to main/)).toBeInTheDocument();
    expect(screen.getAllByText('Enabled')).toHaveLength(1);
    expect(screen.getAllByText('Not enabled')).toHaveLength(1);
  });

  it('enables both tiles for write and branch', () => {
    renderCard(['write', 'branch']);

    expect(screen.getAllByText('Enabled')).toHaveLength(2);
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument();
  });
});

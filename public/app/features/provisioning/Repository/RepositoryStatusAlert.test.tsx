import { render, screen } from 'test/test-utils';

import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryStatusAlert } from './RepositoryStatusAlert';

const repository = {
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test repository',
    type: 'git',
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
  status: {
    health: { healthy: true },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
} as Repository;

describe('RepositoryStatusAlert', () => {
  it('does not render for a healthy repository', () => {
    const { container } = render(<RepositoryStatusAlert repository={repository} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows field error details for an unhealthy repository', () => {
    const detail = 'The repository returned 404 Not Found';
    render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          status: {
            ...repository.status!,
            health: { healthy: false, error: 'health', message: [detail] },
            fieldErrors: [{ type: 'FieldValueInvalid', field: 'secure.token', detail }],
          },
        }}
      />
    );

    expect(screen.getByText('Repository error')).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
  });

  it('shows the deletion error', () => {
    const deleteError = 'Repository cleanup could not delete non-empty folder shared-folder.';
    render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          metadata: { ...repository.metadata, deletionTimestamp: '2026-09-11T00:00:00Z' },
          status: { ...repository.status!, deleteError },
        }}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Repository deletion error')).toBeInTheDocument();
    expect(screen.getByText(deleteError)).toBeInTheDocument();
  });
});

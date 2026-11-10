import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getIsReadOnlyRepo } from './repository';

const view = (overrides: Partial<RepositoryView>): RepositoryView => ({
  name: 'repo',
  title: 'Repo',
  type: 'github',
  target: 'folder',
  workflows: ['write'],
  ...overrides,
});

describe('getIsReadOnlyRepo', () => {
  it('is read-only when the repository supports no workflows', () => {
    expect(getIsReadOnlyRepo(view({ workflows: [] }))).toBe(true);
  });

  it('is writable when the repository supports a workflow', () => {
    expect(getIsReadOnlyRepo(view({ workflows: ['write'] }))).toBe(false);
  });

  it('treats a source repository as read-only even when its workflows are missing', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const workflows = null as unknown as RepositoryView['workflows'];

    expect(getIsReadOnlyRepo(view({ type: 'source', workflows }))).toBe(true);
    expect(getIsReadOnlyRepo(view({ type: 'github', workflows }))).toBe(false);
  });
});

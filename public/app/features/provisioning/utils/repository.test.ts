import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getIsReadOnlyRepo, getIsReadOnlyWorkflows } from './repository';

const view = (overrides: Partial<RepositoryView>): RepositoryView => ({
  name: 'repo',
  title: 'Repo',
  type: 'github',
  target: 'folder',
  workflows: ['write'],
  ...overrides,
});

// A repository view as the API sends it, where an empty workflows list can come back as null or be left out.
const viewFromApi = (type: RepositoryView['type'], workflowsJson?: string): RepositoryView =>
  JSON.parse(
    `{"name":"repo","title":"Repo","target":"folder","type":"${type}"${workflowsJson ? `,"workflows":${workflowsJson}` : ''}}`
  );

describe('getIsReadOnlyRepo', () => {
  it('is read-only when the repository supports no workflows', () => {
    expect(getIsReadOnlyRepo(view({ workflows: [] }))).toBe(true);
  });

  it('is writable when the repository supports a workflow', () => {
    expect(getIsReadOnlyRepo(view({ workflows: ['write'] }))).toBe(false);
  });

  describe('source repositories', () => {
    it.each([
      { name: 'an empty list', repository: view({ type: 'source', workflows: [] }) },
      { name: 'a null list', repository: viewFromApi('source', 'null') },
      { name: 'no list', repository: viewFromApi('source') },
    ])('are read-only with $name of workflows', ({ repository }) => {
      expect(getIsReadOnlyRepo(repository)).toBe(true);
    });

    it('are writable once the write workflow is enabled', () => {
      expect(getIsReadOnlyRepo(view({ type: 'source', workflows: ['write'] }))).toBe(false);
    });

    it('keeps a null list on other repository types as not read-only', () => {
      expect(getIsReadOnlyRepo(viewFromApi('github', 'null'))).toBe(false);
    });
  });
});

describe('getIsReadOnlyWorkflows', () => {
  it.each([
    { name: 'a source without a workflows list', workflows: undefined, repoType: 'source' as const, expected: true },
    { name: 'a source with an empty list', workflows: [], repoType: 'source' as const, expected: true },
    { name: 'a source that can write', workflows: ['write' as const], repoType: 'source' as const, expected: false },
    { name: 'another type without a workflows list', workflows: undefined, repoType: 'git' as const, expected: false },
    { name: 'another type with an empty list', workflows: [], repoType: 'git' as const, expected: true },
  ])('is $expected for $name', ({ workflows, repoType, expected }) => {
    expect(getIsReadOnlyWorkflows(workflows, repoType)).toBe(expected);
  });
});

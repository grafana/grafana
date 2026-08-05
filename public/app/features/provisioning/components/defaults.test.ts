import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getDefaultWorkflow } from './defaults';

function makeRepo(overrides: Partial<RepositoryView> = {}): RepositoryView {
  return {
    name: 'my-repo',
    title: 'My Repo',
    type: 'github',
    target: 'folder',
    branch: 'main',
    workflows: ['write', 'branch'],
    ...overrides,
  };
}

describe('getDefaultWorkflow', () => {
  it('returns the first configured workflow by default', () => {
    expect(getDefaultWorkflow(makeRepo({ workflows: ['write', 'branch'] }))).toBe('write');
    expect(getDefaultWorkflow(makeRepo({ workflows: ['branch', 'write'] }))).toBe('branch');
  });

  it('prefers the branch workflow when the branch name template is enforced', () => {
    const repo = makeRepo({
      workflows: ['write', 'branch'],
      branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}-{{title}}' },
    });
    expect(getDefaultWorkflow(repo)).toBe('branch');
  });

  it('does not force the branch workflow when it is not supported', () => {
    const repo = makeRepo({
      workflows: ['write'],
      branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
    });
    expect(getDefaultWorkflow(repo)).toBe('write');
  });

  it('still honors an explicit loadedFromRef over enforcement', () => {
    const repo = makeRepo({
      workflows: ['write', 'branch'],
      branch: 'main',
      branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
    });
    expect(getDefaultWorkflow(repo, 'feature-branch')).toBe('write');
  });
});

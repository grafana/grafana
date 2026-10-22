import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getRequestRef, getWorkflowForRef, isKnownRef } from './workflow';

const repo: RepositoryView = {
  name: 'repo',
  title: 'Repo',
  type: 'github',
  target: 'folder',
  branch: 'main',
  workflows: ['write', 'branch'],
};

describe('getWorkflowForRef', () => {
  it.each([
    ['the configured branch', 'main', 'write'],
    ['an empty ref', '', 'write'],
    ['an undefined ref', undefined, 'write'],
    ['another branch', 'feature/x', 'branch'],
  ])('is %s → %s', (_label, ref, expected) => {
    expect(getWorkflowForRef(repo, ref)).toBe(expected);
  });

  it('treats any named ref as a branch when the repository has no configured branch', () => {
    expect(getWorkflowForRef({ ...repo, branch: undefined }, 'main')).toBe('branch');
    expect(getWorkflowForRef(undefined, 'main')).toBe('branch');
  });
});

describe('getRequestRef', () => {
  it('omits the ref for a direct write so the backend targets the configured branch', () => {
    expect(getRequestRef(repo, 'main')).toBeUndefined();
    expect(getRequestRef(repo, '')).toBeUndefined();
  });

  it('keeps the ref for a branch commit', () => {
    expect(getRequestRef(repo, 'feature/x')).toBe('feature/x');
  });
});

describe('isKnownRef', () => {
  const refs = { items: [{ name: 'main' }, { name: 'develop' }] };

  it('is true only for a ref present in the listed refs', () => {
    expect(isKnownRef(refs, 'develop')).toBe(true);
    expect(isKnownRef(refs, 'feature/x')).toBe(false);
    expect(isKnownRef(refs, '')).toBe(false);
    expect(isKnownRef(undefined, 'main')).toBe(false);
  });
});

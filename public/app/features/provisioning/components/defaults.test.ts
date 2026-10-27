import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getDefaultRef } from './defaults';

const writeFirst: RepositoryView = {
  name: 'repo',
  title: 'Repo',
  type: 'github',
  target: 'folder',
  branch: 'main',
  workflows: ['write', 'branch'],
};
const branchFirst: RepositoryView = { ...writeFirst, workflows: ['branch', 'write'] };
const writeOnly: RepositoryView = { ...writeFirst, workflows: ['write'] };
const enforced: RepositoryView = {
  ...writeFirst,
  branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
};
// useBranchTemplate replaces this placeholder with the rendered template
const generated = expect.stringMatching(/^dashboard\//);

describe('getDefaultRef', () => {
  it.each<[string, RepositoryView | undefined, string | undefined, unknown]>([
    ['an enforced template starts on a generated branch, even over a preview ref', enforced, 'feature/x', generated],
    [
      'an enforced template without a name stays on the configured branch',
      { ...writeFirst, branchOptions: { enforceTemplate: true } },
      undefined,
      'main',
    ],
    ['a preview ref is kept when the repository can branch', writeFirst, 'feature/x', 'feature/x'],
    ['a preview ref is dropped when the repository is write-only', writeOnly, 'feature/x', 'main'],
    ['a preview of the configured branch is the configured branch', writeFirst, 'main', 'main'],
    ['a branch-first repository starts on a generated branch', branchFirst, undefined, generated],
    ['a write-first repository starts on the configured branch', writeFirst, undefined, 'main'],
    ['a write-only repository starts on the configured branch', writeOnly, undefined, 'main'],
    ['no repository gives an empty ref', undefined, undefined, ''],
  ])('%s', (_label, repository, loadedFromRef, expected) => {
    expect(getDefaultRef(repository, 'dashboard', loadedFromRef)).toEqual(expected);
  });
});

import { renderHook } from '@testing-library/react';

import { type RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { useModeOptions } from './useModeOptions';

const settings = (overrides: Partial<RepositoryViewList> = {}): RepositoryViewList => ({
  kind: 'RepositoryViewList',
  apiVersion: 'provisioning.grafana.app/v0alpha1',
  items: [],
  allowedTargets: ['instance', 'folder', 'folderless'],
  allowImageRendering: false,
  maxRepositories: 0,
  ...overrides,
});

const targetsOf = (options: Array<{ target: string }>) => options.map((o) => o.target);

describe('useModeOptions', () => {
  it('includes folderless as an enabled option when it is an allowed target', () => {
    const { result } = renderHook(() => useModeOptions('repo-a', settings()));

    expect(targetsOf(result.current.enabledOptions)).toContain('folderless');
    expect(targetsOf(result.current.disabledOptions)).not.toContain('folderless');
  });

  it('disables folderless when it is not an allowed target', () => {
    const { result } = renderHook(() => useModeOptions('repo-a', settings({ allowedTargets: ['folder'] })));

    expect(targetsOf(result.current.enabledOptions)).not.toContain('folderless');
    expect(targetsOf(result.current.disabledOptions)).toContain('folderless');
  });

  it('keeps folderless enabled even when another folder is already connected', () => {
    // A connected folder repository only disables the exclusive `instance` target,
    // not `folderless`, which is allowed to coexist.
    const list = settings({
      items: [{ name: 'other-repo', target: 'folder', title: 'Other', type: 'github', workflows: [] }],
    });

    const { result } = renderHook(() => useModeOptions('repo-a', list));

    expect(targetsOf(result.current.enabledOptions)).toContain('folderless');
    expect(targetsOf(result.current.disabledOptions)).toContain('instance');
  });
});

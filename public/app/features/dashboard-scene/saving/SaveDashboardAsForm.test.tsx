import {
  AnnoKeyIgnorePredefinedVariables,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  ManagerKind,
} from 'app/features/apiserver/types';

import { nextMetaAfterSaveAsFolderChange } from './SaveDashboardAsForm';

describe('nextMetaAfterSaveAsFolderChange', () => {
  it('preserves k8s name and resourceVersion when switching folders', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '42',
          annotations: {
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'new-folder',
      {}
    );

    expect(next.folderUid).toBe('new-folder');
    expect(next.k8s?.name).toBe('dash-uid');
    expect(next.k8s?.resourceVersion).toBe('42');
    expect(next.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables]).toBe('global');
  });

  it('overlays provisioned manager annotations without dropping identity fields', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '7',
          annotations: {
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'repo-folder',
      {
        k8s: {
          annotations: {
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeyManagerKind]: ManagerKind.Repo,
          },
        },
      }
    );

    expect(next.k8s?.name).toBe('dash-uid');
    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyIgnorePredefinedVariables]: 'global',
      [AnnoKeyManagerIdentity]: 'my-repo',
      [AnnoKeyManagerKind]: ManagerKind.Repo,
    });
  });

  it('clears previous folder manager annotations when moving to a non-provisioned folder', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'repo-folder',
        k8s: {
          name: 'dash-uid',
          annotations: {
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'plain-folder',
      {}
    );

    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyIgnorePredefinedVariables]: 'global',
    });
  });
});

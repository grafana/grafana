import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeyUseCrossDashboardVariables,
  ManagerKind,
} from 'app/features/apiserver/types';

import { nextMetaAfterSaveAsFolderChange } from './SaveDashboardAsForm';

const selectionAnnotation = '{"global":"all","folder":"none"}';

describe('nextMetaAfterSaveAsFolderChange', () => {
  it('preserves k8s name and resourceVersion when switching folders', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '42',
          annotations: {
            [AnnoKeyUseCrossDashboardVariables]: selectionAnnotation,
          },
        },
      },
      'new-folder',
      {}
    );

    expect(next.folderUid).toBe('new-folder');
    expect(next.k8s?.name).toBe('dash-uid');
    expect(next.k8s?.resourceVersion).toBe('42');
    expect(next.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(selectionAnnotation);
  });

  it('overlays provisioned manager annotations without dropping identity fields', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '7',
          annotations: {
            [AnnoKeyUseCrossDashboardVariables]: selectionAnnotation,
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
      [AnnoKeyUseCrossDashboardVariables]: selectionAnnotation,
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
            [AnnoKeyUseCrossDashboardVariables]: selectionAnnotation,
          },
        },
      },
      'plain-folder',
      {}
    );

    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyUseCrossDashboardVariables]: selectionAnnotation,
    });
  });
});

import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  AnnoKeyUseCrossDashboardVariables,
  ManagerKind,
} from 'app/features/apiserver/types';
import { type DashboardMeta } from 'app/types/dashboard';

import { nextMetaAfterFolderPick } from './shared';

describe('nextMetaAfterFolderPick', () => {
  it('keeps the k8s identity and unrelated annotations, drops the folder-bound ones, and sets the folder', () => {
    const meta: DashboardMeta = {
      folderUid: 'old-folder',
      folderTitle: 'Old folder',
      k8s: {
        name: 'dash-uid',
        resourceVersion: '42',
        annotations: {
          [AnnoKeyManagerIdentity]: 'old-repo',
          [AnnoKeyManagerKind]: ManagerKind.Repo,
          [AnnoKeySourcePath]: 'old-folder/dash.json',
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
        },
      },
    };

    expect(nextMetaAfterFolderPick(meta, 'new-folder', 'New folder')).toEqual({
      folderUid: 'new-folder',
      folderTitle: 'New folder',
      k8s: {
        name: 'dash-uid',
        resourceVersion: '42',
        annotations: { [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}' },
      },
    });
  });

  it('only sets the folder when there is no k8s meta', () => {
    expect(nextMetaAfterFolderPick({ folderUid: 'old-folder' }, '', 'Dashboards')).toEqual({
      folderUid: '',
      folderTitle: 'Dashboards',
      k8s: undefined,
    });
  });
});

import { getBackendSrv } from '@grafana/runtime';

import {
  buildFolderNavigationIndex,
  getFolderNavigationChildren,
  getFolderNavigationTree,
  invalidateFolderNavigationTree,
} from './accessibleFolderTree';

jest.mock('@grafana/api-clients/rtkq/folder/v1beta1', () => ({
  getFolderAPIBaseURL: jest.fn().mockResolvedValue('/apis/folder.grafana.app/v1/namespaces/org-1'),
}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

const items = [
  {
    uid: 'sharedwithme',
    title: 'Shared with me',
    kind: 'virtual' as const,
    access: 'navigation' as const,
    selectable: false,
  },
  { uid: 'restricted', title: 'Restricted', kind: 'folder' as const, access: 'ancestor' as const, selectable: false },
  {
    uid: 'department-a',
    title: 'Department A',
    kind: 'folder' as const,
    navigationParentUid: 'restricted',
    access: 'ancestor' as const,
    selectable: false,
  },
  {
    uid: 'team-a',
    title: 'Team A',
    kind: 'folder' as const,
    navigationParentUid: 'department-a',
    access: 'full' as const,
    selectable: true,
  },
];

describe('accessibleFolderTree', () => {
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateFolderNavigationTree();
    (getBackendSrv as jest.Mock).mockReturnValue({ get });
    get.mockResolvedValue({ items });
  });

  it('uses the App Platform tree endpoint and caches a purpose-specific projection', async () => {
    await Promise.all([getFolderNavigationTree('dashboard-create'), getFolderNavigationTree('dashboard-create')]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/apis/folder.grafana.app/v1/namespaces/org-1/folders/general/tree',
      { purpose: 'dashboard-create' },
      undefined,
      { showErrorAlert: false }
    );
  });

  it('returns only direct projected children and paginates after projection', async () => {
    await expect(getFolderNavigationChildren('department-a', 'browse', 1, 10)).resolves.toEqual([items[3]]);
    await expect(getFolderNavigationChildren(undefined, 'browse', 1, 10)).resolves.toEqual([items[0], items[1]]);
    await expect(getFolderNavigationChildren('department-a', 'browse', 2, 1)).resolves.toEqual([]);

    const index = buildFolderNavigationIndex(items);
    expect(index.byUID.get('team-a')).toEqual(items[3]);
    expect(index.childrenByParent.get('restricted')).toEqual([items[2]]);
  });

  it('evicts failed requests', async () => {
    get.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce({ items });
    await expect(getFolderNavigationTree('browse')).rejects.toThrow('failed');
    await expect(getFolderNavigationTree('browse')).resolves.toEqual(items);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

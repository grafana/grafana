import { getBackendSrv } from '@grafana/runtime';

import {
  getAccessibleFolderChildren,
  getAccessibleFolderTree,
  invalidateAccessibleFolderTree,
} from './accessibleFolderTree';

jest.mock('@grafana/api-clients/rtkq/folder/v1beta1', () => ({
  getFolderAPIBaseURL: jest.fn().mockResolvedValue('/apis/folder.grafana.app/v1/namespaces/org-1'),
}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

const items = [
  { name: 'restricted', title: 'Restricted', access: 'ancestor' as const },
  { name: 'department-a', title: 'Department A', parent: 'restricted', access: 'ancestor' as const },
  { name: 'team-a', title: 'Team A', parent: 'department-a', access: 'full' as const },
];

describe('accessibleFolderTree', () => {
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateAccessibleFolderTree();
    (getBackendSrv as jest.Mock).mockReturnValue({ get });
    get.mockResolvedValue({ items });
  });

  it('uses the App Platform tree endpoint and caches a permission-specific projection', async () => {
    await Promise.all([getAccessibleFolderTree('edit'), getAccessibleFolderTree('edit')]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/apis/folder.grafana.app/v1/namespaces/org-1/folders/general/tree',
      { permission: 'edit' },
      undefined,
      { showErrorAlert: false }
    );
  });

  it('returns only direct projected children and paginates after projection', async () => {
    await expect(getAccessibleFolderChildren('department-a', 'view', 1, 10)).resolves.toEqual([items[2]]);
    await expect(getAccessibleFolderChildren(undefined, 'view', 1, 10)).resolves.toEqual([items[0]]);
    await expect(getAccessibleFolderChildren('department-a', 'view', 2, 1)).resolves.toEqual([]);
  });

  it('evicts failed requests', async () => {
    get.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce({ items });
    await expect(getAccessibleFolderTree('view')).rejects.toThrow('failed');
    await expect(getAccessibleFolderTree('view')).resolves.toEqual(items);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

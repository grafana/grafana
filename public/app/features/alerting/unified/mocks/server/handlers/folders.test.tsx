import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { useGetCombinedFolderQuery } from 'app/api/clients/folder/v1beta1/hooks';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import { setFolderAccessControl, setFolderResponse } from 'app/features/alerting/unified/mocks/server/configure';
import { AccessControlAction } from 'app/types/accessControl';

import { DEFAULT_FOLDERS } from './folders';

setupMswServer();

/** Resolves once `useGetCombinedFolderQuery` has settled, with the folder it produced (if any) and whether it errored. */
const loadFolder = async (uid: string) => {
  const { result } = renderHook(() => useGetCombinedFolderQuery(uid), { wrapper: getWrapper({}) });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return { data: result.current.data, isError: result.current.isError };
};

describe('alerting folder handlers', () => {
  it('serves a seeded folder with its configured ancestors through useGetCombinedFolderQuery', async () => {
    setFolderResponse(
      mockFolder({
        uid: 'child',
        title: 'Child',
        parentUid: 'parent',
        parents: [
          { uid: 'root', title: 'Root', url: '' },
          { uid: 'parent', title: 'Parent', url: '' },
        ],
      })
    );

    const { data } = await loadFolder('child');

    expect(data).toMatchObject({ uid: 'child', title: 'Child', parentUid: 'parent' });
    expect(data?.parents?.map(({ uid, title }) => ({ uid, title }))).toEqual([
      { uid: 'root', title: 'Root' },
      { uid: 'parent', title: 'Parent' },
    ]);
  });

  it('applies the access override to default folders without inventing unknown ones', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });

    const known = await loadFolder(DEFAULT_FOLDERS[0].uid);
    expect(known.data?.accessControl).toEqual({ [AccessControlAction.AlertingRuleUpdate]: true });

    const unknown = await loadFolder('not-seeded');
    expect(unknown.data).toBeUndefined();
    expect(unknown.isError).toBe(true);
  });
});

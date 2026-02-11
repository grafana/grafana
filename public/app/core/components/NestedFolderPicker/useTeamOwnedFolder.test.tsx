import { renderHook, waitFor } from 'test/test-utils';

import { useGetSignedInUserTeamListQuery } from '@grafana/api-clients/rtkq/legacy';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';

import { useGetTeamFolders } from './useTeamOwnedFolder';

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  useSearchDashboardsAndFoldersQuery: jest.fn(),
}));

jest.mock('@grafana/api-clients/rtkq/legacy', () => {
  return {
    ...jest.requireActual('@grafana/api-clients/rtkq/legacy'),
    useGetSignedInUserTeamListQuery: jest.fn(),
  };
});

const useGetSignedInUserTeamListQueryMock = useGetSignedInUserTeamListQuery as jest.Mock;
const useSearchDashboardsAndFoldersQueryMock = useSearchDashboardsAndFoldersQuery as jest.Mock;

describe('useGetTeamFolders', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useGetSignedInUserTeamListQueryMock.mockReturnValue({ data: [] });
    useSearchDashboardsAndFoldersQueryMock.mockReturnValue({ data: { hits: [] }, isLoading: false });
  });

  it('returns folders grouped by team', async () => {
    const teams = [
      { uid: 'team-a', name: 'Team A' },
      { uid: 'team-b', name: 'Team B' },
    ];

    useGetSignedInUserTeamListQueryMock.mockReturnValue({ data: teams });
    useSearchDashboardsAndFoldersQueryMock.mockReturnValue({
      data: {
        hits: [
          {
            name: 'folder-a',
            title: 'Folder A',
            ownerReferences: ['iam.grafana.app/Team/team-a'],
            resource: 'folder',
          },
        ],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useGetTeamFolders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(useSearchDashboardsAndFoldersQuery).toHaveBeenCalledWith(
      {
        ownerReference: ['iam.grafana.app/Team/team-a', 'iam.grafana.app/Team/team-b'],
        type: 'folder',
      },
      { skip: false }
    );

    expect(result.current.foldersByTeam).toEqual([
      {
        team: teams[0],
        folders: [
          {
            name: 'folder-a',
            title: 'Folder A',
            ownerReferences: ['iam.grafana.app/Team/team-a'],
            resource: 'folder',
          },
        ],
      },
    ]);
    expect(result.current.error).toBeUndefined();
  });

  it('returns a team error and skips folder search when team loading fails', async () => {
    useGetSignedInUserTeamListQueryMock.mockReturnValue({ error: new Error('No teams') });
    useSearchDashboardsAndFoldersQueryMock.mockReturnValue({ isLoading: false, data: undefined });

    const { result } = renderHook(() => useGetTeamFolders());

    await waitFor(() => {
      expect(result.current.error?.message).toBe('No teams');
    });

    expect(result.current.isLoading).toBe(false);
    expect(useSearchDashboardsAndFoldersQuery).toHaveBeenCalledWith(
      {
        ownerReference: undefined,
        type: 'folder',
      },
      { skip: true }
    );
  });

  it('skips loading teams and folders when skip is true', () => {
    renderHook(() => useGetTeamFolders({ skip: true }));

    expect(useGetSignedInUserTeamListQuery).toHaveBeenCalledWith(undefined, { skip: true });
    expect(useSearchDashboardsAndFoldersQuery).toHaveBeenCalledWith(
      {
        ownerReference: [],
        type: 'folder',
      },
      { skip: true }
    );
  });
});

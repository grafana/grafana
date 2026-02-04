import { renderHook, waitFor } from 'test/test-utils';

import { useLazySearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { api as profileApi } from 'app/features/profile/api';

import { useGetTeamFolders } from './useTeamOwnedFolder';

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  useLazySearchDashboardsAndFoldersQuery: jest.fn(),
}));

jest.mock('app/features/profile/api', () => ({
  api: {
    loadTeams: jest.fn(),
  },
}));

describe('useGetTeamFolders', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns folders grouped by team', async () => {
    const teams = [
      { uid: 'team-a', name: 'Team A' },
      { uid: 'team-b', name: 'Team B' },
    ];

    const triggerSearch = jest.fn();
    (useLazySearchDashboardsAndFoldersQuery as jest.Mock).mockReturnValue([triggerSearch]);
    (profileApi.loadTeams as jest.Mock).mockResolvedValue(teams);

    const teamARequest = {
      unwrap: jest.fn().mockResolvedValue({ hits: [{ uid: 'folder-a' }] }),
      abort: jest.fn(),
    };

    const teamBRequest = {
      unwrap: jest.fn().mockResolvedValue({ hits: [] }),
      abort: jest.fn(),
    };

    triggerSearch.mockReturnValueOnce(teamARequest).mockReturnValueOnce(teamBRequest);

    const { result } = renderHook(() => useGetTeamFolders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(triggerSearch).toHaveBeenCalledWith({ ownerReference: 'iam.grafana.app/Team/team-a', type: 'folder' }, true);
    expect(triggerSearch).toHaveBeenCalledWith({ ownerReference: 'iam.grafana.app/Team/team-b', type: 'folder' }, true);

    expect(result.current.foldersByTeam).toEqual([
      {
        team: teams[0],
        folders: [{ uid: 'folder-a' }],
      },
    ]);
    expect(result.current.error).toBeUndefined();
  });

  it('returns a team error and skips folder search when team loading fails', async () => {
    const triggerSearch = jest.fn();
    (useLazySearchDashboardsAndFoldersQuery as jest.Mock).mockReturnValue([triggerSearch]);
    (profileApi.loadTeams as jest.Mock).mockRejectedValue(new Error('No teams'));

    const { result } = renderHook(() => useGetTeamFolders());

    await waitFor(() => {
      expect(result.current.error?.message).toBe('No teams');
    });

    expect(result.current.isLoading).toBe(false);
    expect(triggerSearch).not.toHaveBeenCalled();
  });

  it('skips loading teams and folders when skip is true', () => {
    const triggerSearch = jest.fn();
    (useLazySearchDashboardsAndFoldersQuery as jest.Mock).mockReturnValue([triggerSearch]);

    renderHook(() => useGetTeamFolders({ skip: true }));

    expect(profileApi.loadTeams).not.toHaveBeenCalled();
    expect(triggerSearch).not.toHaveBeenCalled();
  });
});

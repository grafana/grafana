import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, getSignedInUserTeamListHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { useGetTeamFolders } from './useTeamOwnedFolder';

setBackendSrv(backendSrv);
setupMockServer();

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

describe('useGetTeamFolders', () => {
  it('returns folders grouped by team', async () => {
    const teams = [
      { uid: 'team-a', name: 'Team A' },
      { uid: 'team-b', name: 'Team B' },
    ];
    const folderHit = {
      name: 'folder-a',
      title: 'Folder A',
      ownerReferences: ['iam.grafana.app/Team/team-a'],
      resource: 'folders',
    };

    server.use(getSignedInUserTeamListHandler(teams), getCustomSearchHandler([folderHit]));
    const capture = captureRequests((r) => r.url.includes('/search'));

    const { result } = renderHook(() => useGetTeamFolders(), { wrapper });

    // isLoading briefly flips false between the teams query resolving and the search query
    // starting, so wait on the final result rather than the loading state
    await waitFor(() => {
      expect(result.current.foldersByTeam).toHaveLength(1);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.foldersByTeam).toEqual([
      {
        team: teams[0],
        folders: [folderHit],
      },
    ]);
    expect(result.current.error).toBeUndefined();

    const [searchRequest] = await capture;
    const searchParams = new URL(searchRequest.url).searchParams;
    expect(searchParams.getAll('ownerReference')).toEqual([
      'iam.grafana.app/Team/team-a',
      'iam.grafana.app/Team/team-b',
    ]);
    expect(searchParams.get('type')).toBe('folder');
  });

  it('returns a team error and skips folder search when team loading fails', async () => {
    server.use(http.get('/api/user/teams', () => HttpResponse.json({ message: 'No teams' }, { status: 500 })));
    const capture = captureRequests((r) => r.url.includes('/search'));

    const { result } = renderHook(() => useGetTeamFolders(), { wrapper });

    await waitFor(() => {
      expect(result.current.error?.message).toBe('No teams');
    });

    expect(result.current.isLoading).toBe(false);

    const searchRequests = await capture;
    expect(searchRequests).toHaveLength(0);
  });
});

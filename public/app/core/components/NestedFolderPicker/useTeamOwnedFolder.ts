import { useMemo } from 'react';

import { type TeamDto, useGetSignedInUserTeamListQuery } from '@grafana/api-clients/internal/rtkq/legacy';
import { isFetchError } from '@grafana/runtime';
import { type FolderChildrenPage, useSearchTeamFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { teamOwnerRef } from 'app/features/browse-dashboards/utils/dashboards';

type TeamFolder = FolderChildrenPage['hits'][number];

type FoldersByTeam = {
  team: TeamDto;
  folders: TeamFolder[];
};

type UseGetTeamFoldersResult = {
  foldersByTeam: FoldersByTeam[];
  isLoading: boolean;
  error: Error | undefined;
};

/**
 * Returns folders owned by teams the current user belongs to.
 */
export function useGetTeamFolders({ markReadOnly }: { markReadOnly?: boolean } = {}): UseGetTeamFoldersResult {
  const { data: teams, error: teamError, isLoading: teamsLoading } = useTeams();

  const ownerReferences = teams?.map(teamOwnerRef);
  const shouldSkipSearch = !ownerReferences?.length;

  const {
    data: foldersResult,
    error: foldersError,
    isLoading: foldersLoading,
  } = useSearchTeamFoldersQuery({ ownerReference: ownerReferences ?? [], markReadOnly }, { skip: shouldSkipSearch });

  const foldersByTeam = useMemo(() => mapTeamsToFolders(teams, foldersResult?.hits), [foldersResult?.hits, teams]);

  return {
    foldersByTeam,
    isLoading: teamsLoading || foldersLoading,
    error: teamError ?? coercedError(foldersError ?? foldersResult?.selectabilityError, 'Failed to load team folders'),
  };
}

function mapTeamsToFolders(teams: TeamDto[] | undefined, folders: TeamFolder[] | undefined): FoldersByTeam[] {
  if (!teams || !folders?.length) {
    return [];
  }

  // Map folders to their owner ownerRef strings
  const foldersMap = folders.reduce<Record<string, TeamFolder[]>>((acc, folder) => {
    // Folder can be owned by multiple teams technically
    for (const ref of folder.ownerReferences ?? []) {
      if (!acc[ref]) {
        acc[ref] = [];
      }
      acc[ref].push(folder);
    }
    return acc;
  }, {});

  return teams
    .map((team) => {
      return {
        team,
        // Each team can own multiple folders
        folders: foldersMap[teamOwnerRef(team)],
      };
    })
    .filter((group) => group.folders && group.folders.length > 0);
}

/**
 * Returns all the teams user is part of.
 */
function useTeams() {
  const { data, error, isLoading } = useGetSignedInUserTeamListQuery();
  return {
    data,
    isLoading,
    error: coercedError(error),
  };
}

/**
 * Coerce error which for some reason is returned as unknown from the RTKQ hook to something more meaningful and typed.
 */
function coercedError(error: unknown, fallbackMessage = 'Failed to load teams') {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return error;
  }

  // FetchError is what our backendSrv is throwing and RTKQ is using it as a base query.
  if (isFetchError(error)) {
    return new Error(error.data?.message ?? error.statusText ?? fallbackMessage);
  }

  return new Error(fallbackMessage);
}

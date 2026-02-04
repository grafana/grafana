import { zip } from 'lodash';
import { useEffect, useState } from 'react';

import type { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { TeamDto } from '@grafana/api-clients/rtkq/legacy';
import { isFetchError } from '@grafana/runtime';
import { useLazySearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { api as profileApi } from 'app/features/profile/api';

type FoldersByTeam = {
  team: TeamDto;
  folders: DashboardHit[];
};

type UseGetTeamFoldersResult = {
  foldersByTeam: FoldersByTeam[];
  isLoading: boolean;
  error: Error | undefined;
};

/**
 * Returns folders owned by teams the current user belongs to.
 */
export function useGetTeamFolders(options?: { skip: boolean }): UseGetTeamFoldersResult {
  const { teams, error: teamError } = useTeams(options);

  // We need the lazy version as we are going to call it for every team in a loop.
  const [triggerSearch] = useLazySearchDashboardsAndFoldersQuery();

  const [foldersByTeam, setFoldersByTeam] = useState<FoldersByTeam[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!teams || teamError) {
      return;
    }

    setFoldersLoading(true);
    setFoldersError(undefined);

    // Map each team to a request to get the folders they own.
    const requests = teams.map((team) => {
      const request = triggerSearch({ ownerReference: `iam.grafana.app/Team/${team.uid}`, type: 'folder' }, true);
      return { team, request };
    });

    Promise.allSettled(requests.map((r) => r.request.unwrap()))
      .then((results) => {
        // Process all the responses and map them to teams

        const teams = requests.map((r) => r.team);
        const foldersByTeam = zip(teams, results).reduce<FoldersByTeam[]>((acc, [team, foldersResult]) => {
          if (foldersResult!.status === 'rejected') {
            console.warn(`Failed getting folders for ${team}`, foldersResult!.reason);
            return acc;
          }

          if (foldersResult!.value.hits && foldersResult!.value.hits.length) {
            acc.push({ team: team!, folders: foldersResult!.value.hits });
          }
          return acc;
        }, []);

        setFoldersByTeam(foldersByTeam);
      })
      .catch((err) => {
        if (!isAbortError(err)) {
          setFoldersError(err);
        }
      })
      .finally(() => {
        setFoldersLoading(false);
      });

    return () => {
      for (const r of requests) {
        r.request.abort();
      }
    };
  }, [teams, teamError, triggerSearch]);

  return {
    foldersByTeam,
    isLoading: (teams === null && !teamError) || foldersLoading,
    error: teamError ?? foldersError,
  };
}

/**
 * Returns all the teams user is part of.
 */
function useTeams(options?: { skip: boolean }) {
  const [teams, setTeams] = useState<TeamDto[] | null>(null);
  const [teamError, setTeamError] = useState<Error | null>(null);

  useEffect(() => {
    if (options?.skip) {
      return;
    }

    const abortController = new AbortController();
    profileApi
      .loadTeams({ abortSignal: abortController.signal })
      .then((result) => {
        setTeams(result);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) {
          if (err instanceof Error) {
            setTeamError(err);
            return;
          }

          if (isFetchError(err)) {
            setTeamError(new Error(err.data?.message ?? err.statusText ?? 'Failed to load teams'));
            return;
          }

          setTeamError(new Error('Failed to load teams'));
        }
      });

    return () => {
      abortController.abort();
    };
  }, [options?.skip]);

  return {
    teams,
    error: teamError,
  };
}

// TODO maybe there should be a common utility like this
function isAbortError(err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }

  return isFetchError(err) && (err.cancelled || err.statusText === 'Request was aborted');
}

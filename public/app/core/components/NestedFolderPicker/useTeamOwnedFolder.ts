import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import type { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { TeamDto } from '@grafana/api-clients/rtkq/legacy';
import { isFetchError } from '@grafana/runtime';
import { useGetSearchQuery, useLazyGetSearchQuery } from 'app/api/clients/dashboard/v0alpha1';
import { api as profileApi } from 'app/features/profile/api';

type FolderByTeam = {
  team: TeamDto;
  folder: DashboardHit;
};

/**
 * Returns folders owned by teams the current user belongs to.
 */
export function useGetTeamFolders() {
  const { teams, error: teamError } = useTeams();

  const [triggerSearch] = useLazyGetSearchQuery();
  const [foldersByTeam, setFoldersByTeam] = useState<FolderByTeam[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<unknown>(undefined);

  useEffect(() => {
    if (!teams || teamError) {
      return;
    }

    setFoldersLoading(true);
    setFoldersError(undefined);

    const requests = teams.map((team) => {
      const owner = team.uid ?? team.name;
      const request = triggerSearch({ owner, type: 'folder' }, true);
      return { team, request };
    });

    Promise.allSettled(requests.map((r) => r.request.unwrap()))
      .then((results) => {
        const next = requests.reduce<FolderByTeam[]>((acc, r, idx) => {
          const result = results[idx];
          const folder = result.status === 'fulfilled' ? result.value.hits?.[0] : undefined;
          if (folder) {
            acc.push({ team: r.team, folder });
          }
          return acc;
        }, []);
        setFoldersByTeam(next);
      })
      .catch((err: unknown) => {
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
 * Returns the first folder owned by any team the current user belongs to.
 */
export function useTeamOwnedFolder() {
  const { teams, error: teamError } = useTeams();

  const owner = useMemo(() => {
    if (!teams || teams.length === 0) {
      return undefined;
    }
    const firstTeam = teams[0];
    // Prefer UID if available, otherwise fallback to name
    return firstTeam.uid ?? firstTeam.name;
  }, [teams]);

  const searchArgs =
    owner !== undefined
      ? {
          owner,
          type: 'folder' as const,
          // Now with the dummy backend this wouldn't work as we filter for owner after we get results
          // from the DB and this would be only applied to the DB call.
          // limit: 1,
        }
      : skipToken;

  const { data, isFetching, error: searchError } = useGetSearchQuery(searchArgs);

  const folder = data?.hits?.[0];

  return {
    folder,
    isLoading: (teams === null && !teamError) || isFetching,
    error: teamError ?? searchError,
  };
}

function useTeams() {
  const [teams, setTeams] = useState<TeamDto[] | null>(null);
  const [teamError, setTeamError] = useState<Error | null>(null);

  useEffect(() => {
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
  }, []);

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

  if (isFetchError(err) && (err.cancelled || err.statusText === 'Request was aborted')) {
    return true;
  }

  return false;
}

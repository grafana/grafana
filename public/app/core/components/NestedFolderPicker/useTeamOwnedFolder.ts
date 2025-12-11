import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { TeamDto } from '@grafana/api-clients/rtkq/legacy';
import { useGetSearchQuery } from 'app/api/clients/dashboard/v0alpha1';
import { api as profileApi } from 'app/features/profile/api';

/**
 * Returns the first folder owned by any team the current user belongs to.
 * Uses the dashboard v0alpha1 search API with the `owner` filter.
 */
export function useTeamOwnedFolder() {
  const [teams, setTeams] = useState<TeamDto[] | null>(null);
  const [teamError, setTeamError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .loadTeams()
      .then((result) => {
        if (!cancelled) {
          setTeams(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTeamError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

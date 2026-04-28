import {
  generatedAPI,
  type SetTeamRolesApiArg,
  type CreateTeamApiArg,
} from '@grafana/api-clients/internal/rtkq/legacy';
import { type RequestOptions } from '@grafana/api-clients/rtkq';

/**
 * Adds a check to the endpoint that will pass on the showSuccessAlert property to the backend_srv. This way it's
 * possible to disable the automatic toast that some of the legacy endpoints produce.
 * @param endpointDefinition
 */
function withSuccessAlertCheck<ApiArg extends {}, Def extends { query?: (arg: ApiArg) => RequestOptions }>(
  endpointDefinition: Def
) {
  const originalQuery = endpointDefinition.query;
  if (!originalQuery) {
    return;
  }

  endpointDefinition.query = (queryArg: ApiArg) => {
    const requestOptions = originalQuery(queryArg);

    const showSuccessAlert = 'showSuccessAlert' in queryArg ? Boolean(queryArg.showSuccessAlert) : undefined;
    return {
      ...requestOptions,
      // Because createTeam API returns a message prop in the response, it would always generate a success toast
      // which may not be always wanted.
      ...(showSuccessAlert !== undefined && { showSuccessAlert }),
    };
  };
}

export const legacyAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    createTeam: (endpointDefinition) => {
      withSuccessAlertCheck<CreateTeamApiArg, typeof endpointDefinition>(endpointDefinition);
    },
    setTeamRoles: (endpointDefinition) => {
      withSuccessAlertCheck<SetTeamRolesApiArg, typeof endpointDefinition>(endpointDefinition);
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/internal/rtkq/legacy';

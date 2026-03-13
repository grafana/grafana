import { generatedAPI } from '@grafana/api-clients/internal/rtkq/legacy';
import { RequestOptions } from '@grafana/api-clients/rtkq';

interface EndpointWithQuery {
  query?: (arg: Record<string, unknown>) => RequestOptions;
}

/**
 * Adds a check to the endpoint that will pass on the showSuccessAlert property to the backend_srv. This way it's
 * possible to disable the automatic toast that some of the legacy endpoints produce.
 * @param endpointDefinition
 */
function withSuccessAlertCheck(endpointDefinition: EndpointWithQuery) {
  const originalQuery = endpointDefinition.query as ((arg: Record<string, unknown>) => RequestOptions) | undefined;
  if (!originalQuery) {
    return;
  }

  endpointDefinition.query = (queryArg) => {
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
    createTeam: (endpointDefinition) => withSuccessAlertCheck(endpointDefinition as EndpointWithQuery),
    setTeamRoles: (endpointDefinition) => withSuccessAlertCheck(endpointDefinition as EndpointWithQuery),
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/internal/rtkq/legacy';
